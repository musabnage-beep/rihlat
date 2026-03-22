import type { Request, Response } from 'express';
import * as couponService from '../services/coupon.service.js';

export async function validateCoupon(req: Request, res: Response) {
  try {
    const { code, orderAmount } = req.body;
    const result = await couponService.validateCoupon(code, orderAmount);
    res.json({ success: true, data: result });
  } catch (error) {
    throw error;
  }
}

export async function getCoupons(req: Request, res: Response) {
  try {
    const { page, limit } = req.query as any;
    const result = await couponService.getCoupons(page, limit);
    res.json({ success: true, ...result });
  } catch (error) {
    throw error;
  }
}

export async function createCoupon(req: Request, res: Response) {
  try {
    const coupon = await couponService.createCoupon(req.body);
    res.status(201).json({ success: true, data: coupon });
  } catch (error) {
    throw error;
  }
}

export async function updateCoupon(req: Request, res: Response) {
  try {
    const coupon = await couponService.updateCoupon(req.params.id, req.body);
    res.json({ success: true, data: coupon });
  } catch (error) {
    throw error;
  }
}

export async function deactivateCoupon(req: Request, res: Response) {
  try {
    const coupon = await couponService.deactivateCoupon(req.params.id);
    res.json({ success: true, data: coupon });
  } catch (error) {
    throw error;
  }
}
