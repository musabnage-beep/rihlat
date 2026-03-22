import type { Request, Response } from 'express';
import * as bookingService from '../services/booking.service.js';
import * as moyasarService from '../services/moyasar.service.js';
import * as customerService from '../services/customer.service.js';

// Booking management

export async function getAllBookings(req: Request, res: Response) {
  try {
    const filters = req.query as any;
    const result = await bookingService.getAllBookings(filters);
    res.json({ success: true, ...result });
  } catch (error) {
    throw error;
  }
}

export async function getAdminBookingDetail(req: Request, res: Response) {
  try {
    const booking = await bookingService.getAdminBookingDetail(req.params.id);
    res.json({ success: true, data: booking });
  } catch (error) {
    throw error;
  }
}

export async function confirmBooking(req: Request, res: Response) {
  try {
    const booking = await bookingService.confirmBooking(req.params.id);
    res.json({ success: true, data: booking });
  } catch (error) {
    throw error;
  }
}

export async function cancelBooking(req: Request, res: Response) {
  try {
    const booking = await bookingService.cancelBookingAdmin(req.params.id, req.body.notes);
    res.json({ success: true, data: booking });
  } catch (error) {
    throw error;
  }
}

export async function processRefund(req: Request, res: Response) {
  try {
    const { amount, reason } = req.body;
    const refund = await moyasarService.processRefund(
      req.params.id,
      amount,
      reason,
      req.user!.id,
    );
    res.json({ success: true, data: refund });
  } catch (error) {
    throw error;
  }
}

export async function updateBookingNotes(req: Request, res: Response) {
  try {
    const booking = await bookingService.updateBookingNotes(req.params.id, req.body.notes);
    res.json({ success: true, data: booking });
  } catch (error) {
    throw error;
  }
}

// Customer management

export async function getCustomers(req: Request, res: Response) {
  try {
    const { search, page, limit } = req.query as any;
    const result = await customerService.getCustomers(search, page, limit);
    res.json({ success: true, ...result });
  } catch (error) {
    throw error;
  }
}

export async function getCustomerDetail(req: Request, res: Response) {
  try {
    const customer = await customerService.getCustomerDetail(req.params.id);
    res.json({ success: true, data: customer });
  } catch (error) {
    throw error;
  }
}

export async function toggleCustomerStatus(req: Request, res: Response) {
  try {
    const customer = await customerService.toggleCustomerStatus(req.params.id, req.body.isActive);
    res.json({ success: true, data: customer });
  } catch (error) {
    throw error;
  }
}
