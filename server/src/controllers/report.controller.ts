import type { Request, Response } from 'express';
import * as reportService from '../services/report.service.js';

export async function getDashboardOverview(_req: Request, res: Response) {
  try {
    const overview = await reportService.getDashboardOverview();
    res.json({ success: true, data: overview });
  } catch (error) {
    throw error;
  }
}

export async function getRevenueReport(req: Request, res: Response) {
  try {
    const { period, from, to } = req.query as {
      period: 'daily' | 'weekly' | 'monthly';
      from: string;
      to: string;
    };
    const report = await reportService.getRevenueReport(period, from, to);
    res.json({ success: true, data: report });
  } catch (error) {
    throw error;
  }
}

export async function getPopularTrips(req: Request, res: Response) {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const trips = await reportService.getPopularTrips(limit);
    res.json({ success: true, data: trips });
  } catch (error) {
    throw error;
  }
}

export async function getBookingTrends(req: Request, res: Response) {
  try {
    const { from, to } = req.query as { from: string; to: string };
    const trends = await reportService.getBookingTrends(from, to);
    res.json({ success: true, data: trends });
  } catch (error) {
    throw error;
  }
}

export async function getPaymentSummary(_req: Request, res: Response) {
  try {
    const summary = await reportService.getPaymentSummary();
    res.json({ success: true, data: summary });
  } catch (error) {
    throw error;
  }
}
