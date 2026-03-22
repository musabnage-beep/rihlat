import type { Request, Response } from 'express';
import * as moyasarService from '../services/moyasar.service.js';
import { env } from '../config/env.js';

export async function initiatePayment(req: Request, res: Response) {
  try {
    const { bookingId } = req.body;
    const result = await moyasarService.initiatePayment(bookingId);
    res.json({ success: true, data: result });
  } catch (error) {
    throw error;
  }
}

export async function handleCallback(req: Request, res: Response) {
  try {
    const { id, status } = req.query as { id: string; status: string };
    const result = await moyasarService.handleCallback(id, status);

    if (result.isPaid) {
      res.redirect(`${env.CLIENT_URL}/booking/confirmation/${result.bookingId}`);
    } else {
      res.redirect(`${env.CLIENT_URL}/booking/failed`);
    }
  } catch (error) {
    res.redirect(`${env.CLIENT_URL}/booking/failed`);
  }
}

export async function getPaymentStatus(req: Request, res: Response) {
  try {
    const payment = await moyasarService.getPaymentByBookingId(req.params.bookingId);
    res.json({ success: true, data: payment });
  } catch (error) {
    throw error;
  }
}
