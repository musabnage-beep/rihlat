import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { parsePagination, buildPaginatedResponse } from '../utils/pagination.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

interface CouponValidationResult {
  couponId: string;
  code: string;
  discountAmount: number;
  discountPercent: number | null;
}

export async function validateCoupon(
  code: string,
  orderAmount: number,
): Promise<CouponValidationResult> {
  const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });

  if (!coupon) {
    throw new NotFoundError('Coupon not found');
  }

  if (!coupon.isActive) {
    throw new BadRequestError('This coupon is no longer active');
  }

  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    throw new BadRequestError('This coupon has expired');
  }

  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    throw new BadRequestError('This coupon has reached its maximum usage limit');
  }

  if (coupon.minOrderAmount && orderAmount < coupon.minOrderAmount.toNumber()) {
    throw new BadRequestError(
      `Minimum order amount for this coupon is ${coupon.minOrderAmount.toNumber()} SAR`,
    );
  }

  let discountAmount = 0;

  if (coupon.discountPercent) {
    discountAmount = (orderAmount * coupon.discountPercent.toNumber()) / 100;
  } else if (coupon.discountAmount) {
    discountAmount = coupon.discountAmount.toNumber();
  }

  if (coupon.maxDiscount && discountAmount > coupon.maxDiscount.toNumber()) {
    discountAmount = coupon.maxDiscount.toNumber();
  }

  if (discountAmount > orderAmount) {
    discountAmount = orderAmount;
  }

  return {
    couponId: coupon.id,
    code: coupon.code,
    discountAmount,
    discountPercent: coupon.discountPercent ? coupon.discountPercent.toNumber() : null,
  };
}

export async function getCoupons(page?: number, limit?: number) {
  const { skip, take } = parsePagination(page, limit);

  const [coupons, total] = await Promise.all([
    prisma.coupon.findMany({
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { bookings: true } },
      },
    }),
    prisma.coupon.count(),
  ]);

  return buildPaginatedResponse(coupons, total, page, limit);
}

interface CreateCouponData {
  code: string;
  description?: string;
  discountPercent?: number;
  discountAmount?: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  maxUses?: number;
  expiresAt?: string | Date;
}

export async function createCoupon(data: CreateCouponData) {
  const existing = await prisma.coupon.findUnique({
    where: { code: data.code.toUpperCase() },
  });

  if (existing) {
    throw new BadRequestError('A coupon with this code already exists');
  }

  return prisma.coupon.create({
    data: {
      code: data.code.toUpperCase(),
      description: data.description ?? null,
      discountPercent: data.discountPercent ?? null,
      discountAmount: data.discountAmount ?? null,
      minOrderAmount: data.minOrderAmount ?? null,
      maxDiscount: data.maxDiscount ?? null,
      maxUses: data.maxUses ?? null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    },
  });
}

export async function updateCoupon(id: string, data: Partial<CreateCouponData>) {
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) {
    throw new NotFoundError('Coupon not found');
  }

  const updateData: Prisma.CouponUpdateInput = {};

  if (data.code !== undefined) {
    const existing = await prisma.coupon.findUnique({
      where: { code: data.code.toUpperCase() },
    });
    if (existing && existing.id !== id) {
      throw new BadRequestError('A coupon with this code already exists');
    }
    updateData.code = data.code.toUpperCase();
  }

  if (data.description !== undefined) updateData.description = data.description;
  if (data.discountPercent !== undefined) updateData.discountPercent = data.discountPercent;
  if (data.discountAmount !== undefined) updateData.discountAmount = data.discountAmount;
  if (data.minOrderAmount !== undefined) updateData.minOrderAmount = data.minOrderAmount;
  if (data.maxDiscount !== undefined) updateData.maxDiscount = data.maxDiscount;
  if (data.maxUses !== undefined) updateData.maxUses = data.maxUses;
  if (data.expiresAt !== undefined) updateData.expiresAt = new Date(data.expiresAt);

  return prisma.coupon.update({
    where: { id },
    data: updateData,
  });
}

export async function deactivateCoupon(id: string) {
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) {
    throw new NotFoundError('Coupon not found');
  }

  return prisma.coupon.update({
    where: { id },
    data: { isActive: false },
  });
}

export async function incrementCouponUsage(couponId: string) {
  await prisma.coupon.update({
    where: { id: couponId },
    data: { usedCount: { increment: 1 } },
  });
}
