import axios from 'axios';
import { PaymentStatus, BookingStatus } from '@prisma/client';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

const moyasarClient = axios.create({
  baseURL: 'https://api.moyasar.com/v1',
  auth: {
    username: env.MOYASAR_SECRET_KEY,
    password: '',
  },
});

export async function initiatePayment(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { trip: true, payment: true },
  });

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  if (booking.payment && booking.payment.status === PaymentStatus.PAID) {
    throw new BadRequestError('This booking has already been paid');
  }

  const amountInHalalah = Math.round(booking.finalAmount.toNumber() * 100);

  const payment = await prisma.payment.upsert({
    where: { bookingId },
    create: {
      bookingId,
      amount: booking.finalAmount,
      currency: 'SAR',
      status: PaymentStatus.INITIATED,
    },
    update: {
      status: PaymentStatus.INITIATED,
    },
  });

  return {
    paymentId: payment.id,
    config: {
      publishable_key: env.MOYASAR_PUBLISHABLE_KEY,
      amount: amountInHalalah,
      currency: 'SAR',
      description: `Booking ${booking.bookingNumber} - ${booking.trip.title}`,
      callback_url: env.MOYASAR_CALLBACK_URL,
      metadata: {
        booking_id: bookingId,
        payment_id: payment.id,
        booking_number: booking.bookingNumber,
      },
    },
  };
}

export async function handleCallback(moyasarPaymentId: string, status: string) {
  const moyasarResponse = await moyasarClient.get(`/payments/${moyasarPaymentId}`);
  const moyasarPayment = moyasarResponse.data;

  const bookingId = moyasarPayment.metadata?.booking_id;
  if (!bookingId) {
    throw new BadRequestError('Missing booking_id in payment metadata');
  }

  const payment = await prisma.payment.findUnique({
    where: { bookingId },
    include: { booking: true },
  });

  if (!payment) {
    throw new NotFoundError('Payment not found for this booking');
  }

  const expectedAmountInHalalah = Math.round(payment.amount.toNumber() * 100);
  if (moyasarPayment.amount !== expectedAmountInHalalah) {
    throw new BadRequestError('Payment amount mismatch');
  }

  const isPaid = moyasarPayment.status === 'paid';

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        moyasarPaymentId,
        status: isPaid ? PaymentStatus.PAID : PaymentStatus.FAILED,
        method: moyasarPayment.source?.type?.toUpperCase() ?? null,
        fee: moyasarPayment.fee ? moyasarPayment.fee / 100 : null,
        moyasarResponse: moyasarPayment,
        callbackData: { status, moyasarPaymentId },
        paidAt: isPaid ? new Date() : null,
      },
    });

    if (isPaid) {
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CONFIRMED,
          confirmedAt: new Date(),
        },
      });
    }
  });

  return { isPaid, bookingId, paymentId: payment.id };
}

export async function processRefund(
  paymentId: string,
  amount: number,
  reason: string,
  processedBy: string,
) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { booking: true },
  });

  if (!payment) {
    throw new NotFoundError('Payment not found');
  }

  if (payment.status !== PaymentStatus.PAID && payment.status !== PaymentStatus.PARTIALLY_REFUNDED) {
    throw new BadRequestError('Payment is not eligible for refund');
  }

  if (!payment.moyasarPaymentId) {
    throw new BadRequestError('No Moyasar payment ID found');
  }

  const amountInHalalah = Math.round(amount * 100);

  const moyasarResponse = await moyasarClient.post(
    `/payments/${payment.moyasarPaymentId}/refunds`,
    { amount: amountInHalalah },
  );

  const refund = await prisma.$transaction(async (tx) => {
    const created = await tx.refund.create({
      data: {
        paymentId: payment.id,
        moyasarRefundId: moyasarResponse.data.id ?? null,
        amount,
        reason,
        processedBy,
      },
    });

    const newRefundedAmount = payment.refundedAmount.toNumber() + amount;
    const isFullRefund = newRefundedAmount >= payment.amount.toNumber();

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        refundedAmount: newRefundedAmount,
        status: isFullRefund ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED,
        refundedAt: new Date(),
      },
    });

    if (isFullRefund) {
      await tx.booking.update({
        where: { id: payment.bookingId },
        data: { status: BookingStatus.REFUNDED },
      });
    }

    return created;
  });

  return refund;
}

export async function getPaymentByBookingId(bookingId: string) {
  const payment = await prisma.payment.findUnique({
    where: { bookingId },
    include: { refunds: true },
  });

  if (!payment) {
    throw new NotFoundError('Payment not found for this booking');
  }

  return payment;
}
