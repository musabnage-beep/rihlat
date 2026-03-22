import { BookingStatus, PaymentStatus } from '@prisma/client';
import { prisma } from '../config/database.js';
import { BadRequestError } from '../utils/errors.js';

export async function getDashboardOverview() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalBookings,
    totalRevenue,
    totalCustomers,
    bookingsThisMonth,
    revenueThisMonth,
  ] = await Promise.all([
    prisma.booking.count({
      where: { status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] } },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: PaymentStatus.PAID },
    }),
    prisma.user.count({ where: { role: 'CUSTOMER' } }),
    prisma.booking.count({
      where: {
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
        createdAt: { gte: startOfMonth },
      },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: PaymentStatus.PAID,
        createdAt: { gte: startOfMonth },
      },
    }),
  ]);

  return {
    totalBookings,
    totalRevenue: totalRevenue._sum.amount?.toNumber() ?? 0,
    totalCustomers,
    bookingsThisMonth,
    revenueThisMonth: revenueThisMonth._sum.amount?.toNumber() ?? 0,
  };
}

export async function getRevenueReport(
  period: 'daily' | 'weekly' | 'monthly',
  from: string,
  to: string,
) {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    throw new BadRequestError('Invalid date range');
  }

  let dateTrunc: string;
  switch (period) {
    case 'daily':
      dateTrunc = 'day';
      break;
    case 'weekly':
      dateTrunc = 'week';
      break;
    case 'monthly':
      dateTrunc = 'month';
      break;
  }

  const results = await prisma.$queryRawUnsafe<
    { period: Date; total_revenue: number; payment_count: number }[]
  >(
    `SELECT
      date_trunc($1, p."createdAt") as period,
      COALESCE(SUM(p.amount), 0)::float as total_revenue,
      COUNT(p.id)::int as payment_count
    FROM payments p
    WHERE p.status = 'PAID'
      AND p."createdAt" >= $2
      AND p."createdAt" <= $3
    GROUP BY period
    ORDER BY period ASC`,
    dateTrunc,
    fromDate,
    toDate,
  );

  return results;
}

export async function getPopularTrips(limit = 10) {
  const trips = await prisma.trip.findMany({
    where: {
      bookings: { some: { status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] } } },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      destination: true,
      pricePerPerson: true,
      images: { where: { isPrimary: true }, take: 1 },
      _count: {
        select: {
          bookings: {
            where: { status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] } },
          },
        },
      },
    },
    orderBy: {
      bookings: { _count: 'desc' },
    },
    take: limit,
  });

  return trips;
}

export async function getBookingTrends(from: string, to: string) {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    throw new BadRequestError('Invalid date range');
  }

  const diffDays =
    (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
  const groupBy = diffDays > 90 ? 'week' : 'day';

  const results = await prisma.$queryRawUnsafe<
    { period: Date; booking_count: number }[]
  >(
    `SELECT
      date_trunc($1, b."createdAt") as period,
      COUNT(b.id)::int as booking_count
    FROM bookings b
    WHERE b."createdAt" >= $2
      AND b."createdAt" <= $3
    GROUP BY period
    ORDER BY period ASC`,
    groupBy,
    fromDate,
    toDate,
  );

  return results;
}

export async function getPaymentSummary() {
  const [byStatus, byMethod] = await Promise.all([
    prisma.payment.groupBy({
      by: ['status'],
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.payment.groupBy({
      by: ['method'],
      _sum: { amount: true },
      _count: { id: true },
      where: { status: PaymentStatus.PAID },
    }),
  ]);

  return {
    byStatus: byStatus.map((s) => ({
      status: s.status,
      total: s._sum.amount?.toNumber() ?? 0,
      count: s._count.id,
    })),
    byMethod: byMethod.map((m) => ({
      method: m.method,
      total: m._sum.amount?.toNumber() ?? 0,
      count: m._count.id,
    })),
  };
}
