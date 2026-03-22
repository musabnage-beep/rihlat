import { Router } from 'express';
import * as paymentController from '../controllers/payment.controller.js';

const router = Router();

router.post('/initiate', paymentController.initiatePayment);
router.get('/callback', paymentController.handleCallback);
router.get('/status/:bookingId', paymentController.getPaymentStatus);

export default router;
