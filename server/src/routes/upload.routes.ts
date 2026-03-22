import { Router } from 'express';
import * as uploadController from '../controllers/upload.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { uploadSingle } from '../middleware/upload.js';

const router = Router();

router.post(
  '/',
  authenticate,
  requireRole('ADMIN', 'EMPLOYEE'),
  uploadSingle,
  uploadController.uploadImage,
);
router.delete(
  '/:filename',
  authenticate,
  requireRole('ADMIN', 'EMPLOYEE'),
  uploadController.deleteImage,
);

export default router;
