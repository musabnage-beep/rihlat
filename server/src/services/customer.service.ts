import { Prisma, UserRole, BookingStatus } from '@prisma/client';
import { prisma } from '../config/database.js';
import { parsePagination, buildPaginatedResponse } from '../utils/pagination.js';
import { NotFoundError } from '../utils/errors.js';

export async function getCustomers(search?: string, page?: number, limit?: number) {
  const { skip, take } = parsePagination(page, limit);

  const where: Prisma.UserWhereInput = {
    role: UserRole.CUSTOMER,
  };

  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [customers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        _count: {
          select: { bookings: true },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return buildPaginatedResponse(customers, total, page, limit);
}

export async function getCustomerDetail(userId: string) {
  const customer = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      avatarUrl: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      bookings: {
        orderBy: { createdAt: 'desc' },
        include: {
          trip: {
            select: { title: true, slug: true, destination: true },
          },
          payment: {
            select: { status: true, method: true, amount: true },
          },
        },
      },
      _count: {
        select: {
          bookings: true,
        },
      },
    },
  });

  if (!customer) {
    throw new NotFoundError('Customer not found');
  }

  return customer;
}

export async function toggleCustomerStatus(userId: string, isActive: boolean) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('Customer not found');
  }

  if (user.role !== UserRole.CUSTOMER) {
    throw new NotFoundError('Customer not found');
  }

  return prisma.user.update({
    where: { id: userId },
    data: { isActive },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
    },
  });
}
