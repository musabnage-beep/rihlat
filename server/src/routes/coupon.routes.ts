import { Router } from 'express';
import * as couponController from '../controllers/coupon.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { createCouponSchema, updateCouponSchema, validateCouponSchema } from '../validators/coupon.schema.js';
import { paginationSchema } from '../validators/common.schema.js';

const router = Router();

// Public
router.post('/validate', validateBody(validateCouponSchema), couponController.validateCoupon);

// Admin
router.get(
  '/',
  authenticate,
  requireRole('ADMIN', 'EMPLOYEE'),
  validateQuery(paginationSchema),
  couponController.getCoupons,
);
router.post(
  '/',
  authenticate,
  requireRole('ADMIN'),
  validateBody(createCouponSchema),
  couponController.createCoupon,
);
router.put(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  validateBody(updateCouponSchema),
  couponController.updateCoupon,
);
router.patch(
  '/:id/deactivate',
  authenticate,
  requireRole('ADMIN'),
  couponController.deactivateCoupon,
);

export default router;
