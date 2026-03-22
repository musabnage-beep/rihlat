import { Router } from 'express';
import * as tripController from '../controllers/trip.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { uploadMultiple } from '../middleware/upload.js';
import { createTripSchema, updateTripSchema, tripQuerySchema } from '../validators/trip.schema.js';

const router = Router();

// Public routes
router.get('/', validateQuery(tripQuerySchema), tripController.getTrips);
router.get('/featured', tripController.getFeaturedTrips);
router.get('/categories', tripController.getCategories);
router.get('/:slug', tripController.getTripBySlug);

// Admin routes
router.post(
  '/',
  authenticate,
  requireRole('ADMIN', 'EMPLOYEE'),
  validateBody(createTripSchema),
  tripController.createTrip,
);
router.put(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'EMPLOYEE'),
  validateBody(updateTripSchema),
  tripController.updateTrip,
);
router.patch(
  '/:id/status',
  authenticate,
  requireRole('ADMIN', 'EMPLOYEE'),
  tripController.updateTripStatus,
);
router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  tripController.deleteTrip,
);

// Image management
router.post(
  '/:id/images',
  authenticate,
  requireRole('ADMIN', 'EMPLOYEE'),
  uploadMultiple(10),
  tripController.uploadImages,
);
router.delete(
  '/:id/images/:imageId',
  authenticate,
  requireRole('ADMIN', 'EMPLOYEE'),
  tripController.removeImage,
);
router.put(
  '/:id/images/reorder',
  authenticate,
  requireRole('ADMIN', 'EMPLOYEE'),
  tripController.reorderImages,
);

export default router;
