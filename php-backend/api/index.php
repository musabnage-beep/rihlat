<?php

// Error handling
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Headers
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

// Load core
require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/helpers.php';
require_once __DIR__ . '/../utils/jwt.php';
require_once __DIR__ . '/../utils/router.php';
require_once __DIR__ . '/../middleware/auth.php';

// Load controllers
require_once __DIR__ . '/../controllers/auth.php';
require_once __DIR__ . '/../controllers/trips.php';
require_once __DIR__ . '/../controllers/bookings.php';
require_once __DIR__ . '/../controllers/payments.php';
require_once __DIR__ . '/../controllers/coupons.php';
require_once __DIR__ . '/../controllers/admin.php';
require_once __DIR__ . '/../controllers/reports.php';
require_once __DIR__ . '/../controllers/notifications.php';
require_once __DIR__ . '/../controllers/settings.php';
require_once __DIR__ . '/../controllers/upload.php';

// CORS
$allowedOrigins = array_map('trim', explode(',', CLIENT_URL));
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins) || CLIENT_URL === '*') {
    header('Access-Control-Allow-Origin: ' . ($origin ?: '*'));
}
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Max-Age: 86400');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Global error handler
set_exception_handler(function (Throwable $e) {
    error_log($e->getMessage() . "\n" . $e->getTraceAsString());
    jsonError('Internal server error', 500);
});

// Parse URI - remove /api prefix
$uri = $_SERVER['REQUEST_URI'];
$basePath = '/api';
if (strpos($uri, $basePath) === 0) {
    $uri = substr($uri, strlen($basePath));
}
if ($uri === '' || $uri === false) $uri = '/';

$method = $_SERVER['REQUEST_METHOD'];

// Router
$router = new Router();

// Auth routes
$router->group('/auth', function(Router $r) {
    $r->post('/register', 'registerUser');
    $r->post('/login', 'loginUser');
    $r->post('/refresh', 'refreshTokenHandler');
    $r->post('/logout', 'logoutUser');
    $r->get('/me', 'getMe');
    $r->put('/me', 'updateMe');
    $r->put('/change-password', 'changePassword');
});

// Trip routes (public)
$router->group('/trips', function(Router $r) {
    $r->get('', 'getTrips');
    $r->get('/featured', 'getFeaturedTrips');
    $r->get('/categories', 'getCategories');
    $r->get('/{slug}', 'getTripBySlug');
    $r->post('', 'createTrip');
    $r->put('/{id}', 'updateTrip');
    $r->delete('/{id}', 'deleteTrip');
    $r->post('/{id}/images', 'addTripImages');
    $r->delete('/{id}/images/{imageId}', 'removeTripImage');
});

// Booking routes
$router->group('/bookings', function(Router $r) {
    $r->post('', 'createBooking');
    $r->get('', 'getMyBookings');
    $r->get('/guest', 'lookupGuestBooking');
    $r->get('/{id}', 'getBookingDetail');
    $r->post('/{id}/cancel', 'cancelMyBooking');
});

// Payment routes
$router->group('/payments', function(Router $r) {
    $r->post('/initiate', 'initiatePayment');
    $r->get('/callback', 'paymentCallback');
    $r->get('/{bookingId}', 'getPaymentStatus');
});

// Coupon routes
$router->post('/coupons/validate', 'validateCouponEndpoint');

// Notification routes (customer)
$router->group('/notifications', function(Router $r) {
    $r->get('', 'getUserNotifications');
    $r->get('/unread-count', 'getUnreadCount');
    $r->put('/{id}/read', 'markNotificationRead');
    $r->put('/read-all', 'markAllNotificationsRead');
});

// Settings (public)
$router->get('/settings', 'getCompanySettings');

// Upload
$router->post('/upload', 'uploadImage');
$router->delete('/upload', 'deleteImage');

// Admin routes
$router->group('/admin', function(Router $r) {
    // Dashboard
    $r->get('/dashboard', 'getDashboardOverview');

    // Trips (admin)
    $r->get('/trips', 'adminGetTrips');
    $r->get('/trips/{id}', 'adminGetTripById');
    $r->post('/trips', 'createTrip');
    $r->put('/trips/{id}', 'updateTrip');
    $r->delete('/trips/{id}', 'deleteTrip');
    $r->post('/trips/{id}/images', 'adminAddTripImages');
    $r->delete('/trips/{id}/images/{imageId}', 'removeTripImage');

    // Bookings
    $r->get('/bookings', 'adminGetBookings');
    $r->get('/bookings/{id}', 'adminGetBookingDetail');
    $r->post('/bookings/{id}/confirm', 'adminConfirmBooking');
    $r->post('/bookings/{id}/cancel', 'adminCancelBooking');
    $r->post('/bookings/{id}/complete', 'adminCompleteBooking');
    $r->patch('/bookings/{id}/status', 'adminUpdateBookingStatus');

    // Customers
    $r->get('/customers', 'adminGetCustomers');
    $r->get('/customers/{id}', 'adminGetCustomerDetail');
    $r->put('/customers/{id}/toggle-status', 'adminToggleCustomerStatus');

    // Coupons
    $r->get('/coupons', 'adminGetCoupons');
    $r->post('/coupons', 'adminCreateCoupon');
    $r->put('/coupons/{id}', 'adminUpdateCoupon');
    $r->delete('/coupons/{id}', 'adminDeleteCoupon');

    // Reports
    $r->get('/reports', 'getReportsOverview');
    $r->get('/reports/revenue', 'getRevenueReport');
    $r->get('/reports/booking-trends', 'getBookingTrends');
    $r->get('/reports/popular-trips', 'getPopularTripsReport');

    // Settings (admin)
    $r->get('/settings', 'adminGetSettings');
    $r->put('/settings', 'updateCompanySettings');

    // Employees
    $r->get('/employees', 'getEmployees');
    $r->post('/employees', 'createEmployee');
    $r->put('/employees/{id}', 'updateEmployee');
    $r->delete('/employees/{id}', 'deleteEmployee');

    // Notifications
    $r->get('/notifications', 'adminGetNotifications');
    $r->post('/notifications', 'adminSendNotification');

    // Refunds
    $r->post('/refunds', 'adminRefund');
});

// Dispatch
$router->dispatch($method, $uri);
