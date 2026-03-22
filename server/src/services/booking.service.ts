import { BookingStatus, Prisma, TripStatus } from '@prisma/client';
import { prisma } from '../config/database.js';
import { parsePagination, buildPaginatedResponse } from '../utils/pagination.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { validateCoupon, incrementCouponUsage } from './coupon.service.js';

interface PassengerInput {
  firstName: string;
  lastName: string;
  age?: number;
  idNumber?: string;
  tierName?: string;
}

interface CreateBookingData {
  tripId: string;
  passengers: PassengerInput[];
  couponCode?: string;
  specialRequests?: string;
  userId?: string;
  guest?: {
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
  };
}

interface BookingFilters {
  status?: BookingStatus;
  search?: string;
  page?: number;
  limit?: number;
}

function generateBookingNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BK-${datePart}-${randomPart}`;
}

export async function createBooking(data: CreateBookingData) {
  const trip = await prisma.trip.findUnique({ where: { id: data.tripId } });
  if (!trip) {
    throw new NotFoundError('Trip not found');
  }

  if (trip.status !== TripStatus.PUBLISHED) {
    throw new BadRequestError('This trip is not available for booking');
  }

  const numberOfPersons = data.passengers.length;
  if (numberOfPersons < 1) {
    throw new BadRequestError('At least one passenger is required');
  }

  if (trip.availableSeats < numberOfPersons) {
    throw new BadRequestError(
      `Only ${trip.availableSeats} seats available, but ${numberOfPersons} requested`,
    );
  }

  let totalAmount = new Prisma.Decimal(0);
  for (const passenger of data.passengers) {
    if (passenger.tierName) {
      const tier = await prisma.pricingTier.findFirst({
        where: { tripId: trip.id, name: passenger.tierName },
      });
      if (tier) {
        totalAmount = totalAmount.add(tier.price);
      } else {
        totalAmount = totalAmount.add(trip.pricePerPerson);
      }
    } else {
      totalAmount = totalAmount.add(trip.pricePerPerson);
    }
  }

  let discountAmount = new Prisma.Decimal(0);
  let couponId: string | undefined;

  if (data.couponCode) {
    const couponResult = await validateCoupon(data.couponCode, totalAmount.toNumber());
    discountAmount = new Prisma.Decimal(couponResult.discountAmount);
    couponId = couponResult.couponId;
  }

  const finalAmount = totalAmount.sub(discountAmount);
  const bookingNumber = generateBookingNumber();

  let guestBookerId: string | undefined;
  if (!data.userId && data.guest) {
    const guestBooker = await prisma.guestBooker.create({
      data: {
        email: data.guest.email,
        phone: data.guest.phone,
        firstName: data.guest.firstName,
        lastName: data.guest.lastName,
      },
    });
    guestBookerId = guestBooker.id;
  }

  const booking = await prisma.$transaction(async (tx) => {
    const created = await tx.booking.create({
      data: {
        bookingNumber,
        tripId: data.tripId,
        userId: data.userId ?? null,
        guestBookerId: guestBookerId ?? null,
        couponId: couponId ?? null,
        numberOfPersons,
        totalAmount,
        discountAmount,
        finalAmount,
        specialRequests: data.specialRequests ?? null,
        passengers: {
          create: data.passengers.map((p) => ({
            firstName: p.firstName,
            lastName: p.lastName,
            age: p.age ?? null,
            idNumber: p.idNumber ?? null,
            tierName: p.tierName ?? null,
          })),
        },
      },
      include: {
        passengers: true,
        trip: { include: { images: { where: { isPrimary: true }, take: 1 } } },
      },
    });

    await tx.trip.update({
      where: { id: data.tripId },
      data: { availableSeats: { decrement: numberOfPersons } },
    });

    if (couponId) {
      await incrementCouponUsage(couponId);
    }

    return created;
  });

  return booking;
}

export async function getMyBookings(userId: string, page?: number, limit?: number) {
  const { skip, take } = parsePagination(page, limit);

  const where: Prisma.BookingWhereInput = { userId };

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        trip: { include: { images: { where: { isPrimary: true }, take: 1 } } },
        payment: { select: { status: true, method: true } },
      },
    }),
    prisma.booking.count({ where }),
  ]);

  return buildPaginatedResponse(bookings, total, page, limit);
}

export async function getBookingDetail(bookingId: string, userId?: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      trip: { include: { images: true } },
      passengers: true,
      payment: true,
      coupon: true,
    },
  });

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  if (userId && booking.userId !== userId) {
    throw new ForbiddenError('You do not have access to this booking');
  }

  return booking;
}

export async function lookupGuestBooking(bookingNumber: string, email: string) {
  const booking = await prisma.booking.findUnique({
    where: { bookingNumber },
    include: {
      trip: { include: { images: { where: { isPrimary: true }, take: 1 } } },
      passengers: true,
      payment: { select: { status: true, method: true } },
      guestBooker: true,
    },
  });

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  if (!booking.guestBooker || booking.guestBooker.email !== email) {
    throw new NotFoundError('Booking not found');
  }

  return booking;
}

export async function cancelBooking(bookingId: string, userId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  if (booking.userId !== userId) {
    throw new ForbiddenError('You do not have access to this booking');
  }

  if (booking.status === BookingStatus.CANCELLED) {
    throw new BadRequestError('Booking is already cancelled');
  }

  if (booking.status === BookingStatus.COMPLETED) {
    throw new BadRequestError('Cannot cancel a completed booking');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const cancelled = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
      },
      include: { trip: true },
    });

    await tx.trip.update({
      where: { id: booking.tripId },
      data: { availableSeats: { increment: booking.numberOfPersons } },
    });

    return cancelled;
  });

  return updated;
}

export async function getAllBookings(filters: BookingFilters) {
  const { skip, take } = parsePagination(filters.page, filters.limit);

  const where: Prisma.BookingWhereInput = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.search) {
    where.OR = [
      { bookingNumber: { contains: filters.search, mode: 'insensitive' } },
      { user: { email: { contains: filters.search, mode: 'insensitive' } } },
      { user: { firstName: { contains: filters.search, mode: 'insensitive' } } },
      { user: { lastName: { contains: filters.search, mode: 'insensitive' } } },
      { guestBooker: { email: { contains: filters.search, mode: 'insensitive' } } },
    ];
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        trip: { select: { title: true, slug: true, destination: true } },
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        guestBooker: { select: { email: true, firstName: true, lastName: true } },
        payment: { select: { status: true, method: true } },
      },
    }),
    prisma.booking.count({ where }),
  ]);

  return buildPaginatedResponse(bookings, total, filters.page, filters.limit);
}

export async function getAdminBookingDetail(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      trip: { include: { images: true } },
      user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
      guestBooker: true,
      passengers: true,
      payment: { include: { refunds: true } },
      coupon: true,
    },
  });

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  return booking;
}

export async function confirmBooking(bookingId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  if (booking.status !== BookingStatus.PENDING) {
    throw new BadRequestError('Only pending bookings can be confirmed');
  }

  return prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: BookingStatus.CONFIRMED,
      confirmedAt: new Date(),
    },
  });
}

export async function cancelBookingAdmin(bookingId: string, notes?: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  if (booking.status === BookingStatus.CANCELLED) {
    throw new BadRequestError('Booking is already cancelled');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const cancelled = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        notes: notes ?? booking.notes,
      },
    });

    await tx.trip.update({
      where: { id: booking.tripId },
      data: { availableSeats: { increment: booking.numberOfPersons } },
    });

    return cancelled;
  });

  return updated;
}

export async function updateBookingNotes(bookingId: string, notes: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  return prisma.booking.update({
    where: { id: bookingId },
    data: { notes },
  });
}
