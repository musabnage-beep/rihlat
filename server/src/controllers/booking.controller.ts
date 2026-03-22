import type { Request, Response } from 'express';
import * as bookingService from '../services/booking.service.js';
import { BadRequestError } from '../utils/errors.js';

export async function createBooking(req: Request, res: Response) {
  try {
    const data = {
      ...req.body,
      userId: req.user?.id,
    };

    if (!req.user && !data.guest) {
      throw new BadRequestError('Guest information is required for unauthenticated bookings');
    }

    const booking = await bookingService.createBooking(data);
    res.status(201).json({ success: true, data: booking });
  } catch (error) {
    throw error;
  }
}

export async function getMyBookings(req: Request, res: Response) {
  try {
    const { page, limit } = req.query as any;
    const result = await bookingService.getMyBookings(req.user!.id, page, limit);
    res.json({ success: true, ...result });
  } catch (error) {
    throw error;
  }
}

export async function getBookingDetail(req: Request, res: Response) {
  try {
    const booking = await bookingService.getBookingDetail(req.params.id, req.user!.id);
    res.json({ success: true, data: booking });
  } catch (error) {
    throw error;
  }
}

export async function lookupGuestBooking(req: Request, res: Response) {
  try {
    const { bookingNumber, email } = req.query as { bookingNumber: string; email: string };
    const booking = await bookingService.lookupGuestBooking(bookingNumber, email);
    res.json({ success: true, data: booking });
  } catch (error) {
    throw error;
  }
}

export async function cancelBooking(req: Request, res: Response) {
  try {
    const booking = await bookingService.cancelBooking(req.params.id, req.user!.id);
    res.json({ success: true, data: booking });
  } catch (error) {
    throw error;
  }
}
