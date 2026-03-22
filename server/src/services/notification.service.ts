import { NotificationType, UserRole } from '@prisma/client';
import { prisma } from '../config/database.js';
import { parsePagination, buildPaginatedResponse } from '../utils/pagination.js';
import { NotFoundError } from '../utils/errors.js';

export async function sendNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  metadata?: Record<string, unknown>,
) {
  const notification = await prisma.notification.create({
    data: {
      type,
      title,
      body,
      metadata: (metadata ?? undefined) as any,
      recipients: {
        create: { userId },
      },
    },
    include: { recipients: true },
  });

  return notification;
}

export async function sendBulkNotification(
  userIds: string[],
  type: NotificationType,
  title: string,
  body: string,
  metadata?: Record<string, unknown>,
) {
  const notification = await prisma.notification.create({
    data: {
      type,
      title,
      body,
      metadata: (metadata ?? undefined) as any,
      recipients: {
        create: userIds.map((userId) => ({ userId })),
      },
    },
    include: { recipients: true },
  });

  return notification;
}

export async function broadcastNotification(
  type: NotificationType,
  title: string,
  body: string,
  metadata?: Record<string, unknown>,
) {
  const customers = await prisma.user.findMany({
    where: { role: UserRole.CUSTOMER, isActive: true },
    select: { id: true },
  });

  if (customers.length === 0) {
    return null;
  }

  const notification = await prisma.notification.create({
    data: {
      type,
      title,
      body,
      metadata: (metadata ?? undefined) as any,
      recipients: {
        create: customers.map((c) => ({ userId: c.id })),
      },
    },
    include: { _count: { select: { recipients: true } } },
  });

  return notification;
}

export async function getUserNotifications(userId: string, page?: number, limit?: number) {
  const { skip, take } = parsePagination(page, limit);

  const where = { userId };

  const [notifications, total] = await Promise.all([
    prisma.userNotification.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        notification: true,
      },
    }),
    prisma.userNotification.count({ where }),
  ]);

  return buildPaginatedResponse(notifications, total, page, limit);
}

export async function markAsRead(notificationId: string, userId: string) {
  const userNotification = await prisma.userNotification.findFirst({
    where: { notificationId, userId },
  });

  if (!userNotification) {
    throw new NotFoundError('Notification not found');
  }

  return prisma.userNotification.update({
    where: { id: userNotification.id },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}

export async function markAllAsRead(userId: string) {
  await prisma.userNotification.updateMany({
    where: { userId, isRead: false },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.userNotification.count({
    where: { userId, isRead: false },
  });
}

export async function sendBookingConfirmation(booking: {
  id: string;
  bookingNumber: string;
  userId: string | null;
  trip: { title: string };
}) {
  if (!booking.userId) return;

  await sendNotification(
    booking.userId,
    NotificationType.BOOKING_CONFIRMATION,
    'Booking Confirmed',
    `Your booking ${booking.bookingNumber} for "${booking.trip.title}" has been confirmed.`,
    { bookingId: booking.id, bookingNumber: booking.bookingNumber },
  );
}

export async function sendPaymentSuccess(booking: {
  id: string;
  bookingNumber: string;
  userId: string | null;
  trip: { title: string };
}) {
  if (!booking.userId) return;

  await sendNotification(
    booking.userId,
    NotificationType.PAYMENT_SUCCESS,
    'Payment Successful',
    `Payment for booking ${booking.bookingNumber} (${booking.trip.title}) was successful.`,
    { bookingId: booking.id, bookingNumber: booking.bookingNumber },
  );
}

export async function sendBookingCancellation(booking: {
  id: string;
  bookingNumber: string;
  userId: string | null;
  trip: { title: string };
}) {
  if (!booking.userId) return;

  await sendNotification(
    booking.userId,
    NotificationType.BOOKING_CANCELLATION,
    'Booking Cancelled',
    `Your booking ${booking.bookingNumber} for "${booking.trip.title}" has been cancelled.`,
    { bookingId: booking.id, bookingNumber: booking.bookingNumber },
  );
}
