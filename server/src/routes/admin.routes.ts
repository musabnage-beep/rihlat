import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import * as reportController from '../controllers/report.controller.js';
import * as settingsController from '../controllers/settings.controller.js';
import * as notificationController from '../controllers/notification.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';

const router = Router();

// All admin routes require authentication and admin/employee role
router.use(authenticate);
router.use(requireRole('ADMIN', 'EMPLOYEE'));

// Booking management
router.get('/bookings', adminController.getAllBookings);
router.get('/bookings/:id', adminController.getAdminBookingDetail);
router.patch('/bookings/:id/confirm', adminController.confirmBooking);
router.patch('/bookings/:id/cancel', adminController.cancelBooking);
router.put('/bookings/:id/notes', adminController.updateBookingNotes);

// Payment / refund (admin-only)
router.post('/payments/:id/refund', requireRole('ADMIN'), adminController.processRefund);

// Customer management
router.get('/customers', adminController.getCustomers);
router.get('/customers/:id', adminController.getCustomerDetail);
router.patch('/customers/:id/status', adminController.toggleCustomerStatus);

// Reports
router.get('/reports/overview', reportController.getDashboardOverview);
router.get('/reports/revenue', reportController.getRevenueReport);
router.get('/reports/popular-trips', reportController.getPopularTrips);
router.get('/reports/booking-trends', reportController.getBookingTrends);
router.get('/reports/payment-summary', reportController.getPaymentSummary);

// Settings (admin-only)
router.get('/settings', settingsController.getSettings);
router.put('/settings', requireRole('ADMIN'), settingsController.updateSettings);

// Employee management (admin-only)
router.get('/settings/employees', settingsController.getEmployees);
router.post('/settings/employees', requireRole('ADMIN'), settingsController.createEmployee);
router.put('/settings/employees/:id', requireRole('ADMIN'), settingsController.updateEmployee);
router.patch('/settings/employees/:id/deactivate', requireRole('ADMIN'), settingsController.deactivateEmployee);

// Admin notifications
router.post('/notifications/send', notificationController.sendNotification);
router.post('/notifications/broadcast', notificationController.broadcastNotification);

export default router;
