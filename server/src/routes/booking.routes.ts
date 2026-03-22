import { Router } from 'express';
import * as bookingController from '../controllers/booking.controller.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { createBookingSchema, lookupBookingSchema } from '../validators/booking.schema.js';
import { paginationSchema } from '../validators/common.schema.js';

const router = Router();

// Public / optionally authenticated
router.post('/', optionalAuth, validateBody(createBookingSchema), bookingController.createBooking);
router.get('/lookup', validateQuery(lookupBookingSchema), bookingController.lookupGuestBooking);

// Authenticated user routes
router.get('/my', authenticate, validateQuery(paginationSchema), bookingController.getMyBookings);
router.get('/:id', authenticate, bookingController.getBookingDetail);
router.post('/:id/cancel', authenticate, bookingController.cancelBooking);

export default router;
