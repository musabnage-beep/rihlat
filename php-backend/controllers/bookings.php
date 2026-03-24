<?php

require_once __DIR__ . '/../utils/helpers.php';
require_once __DIR__ . '/../middleware/auth.php';

/**
 * POST /bookings - Create a new booking (supports guest and authenticated).
 */
function createBooking($params): void {
    $user = optionalAuth();
    $body = getJsonBody();
    $pdo = db();

    $tripId         = $body['tripId'] ?? '';
    $passengers     = $body['passengers'] ?? [];
    $specialRequests = sanitizeString($body['specialRequests'] ?? '');
    $couponCode     = $body['couponCode'] ?? '';
    $guestData      = $body['guest'] ?? null;

    if (empty($tripId)) {
        jsonError('Trip ID is required', 400);
    }

    if (empty($passengers) || !is_array($passengers)) {
        jsonError('At least one passenger is required', 400);
    }

    // Get trip
    $stmt = $pdo->prepare("SELECT * FROM trips WHERE id = ? AND status = 'PUBLISHED'");
    $stmt->execute([$tripId]);
    $trip = $stmt->fetch();

    if (!$trip) {
        jsonError('Trip not found or not available', 404);
    }

    // Check available seats
    $stmt = $pdo->prepare("SELECT COALESCE(SUM(number_of_persons), 0) FROM bookings WHERE trip_id = ? AND status IN ('CONFIRMED','COMPLETED','PENDING')");
    $stmt->execute([$tripId]);
    $bookedSeats = (int) $stmt->fetchColumn();
    $availableSeats = (int) $trip['max_persons'] - $bookedSeats;
    $numPersons = count($passengers);

    if ($numPersons > $availableSeats) {
        jsonError('Not enough available seats', 400);
    }

    // Calculate pricing
    $pricingTiers = $trip['pricing_tiers'] ? json_decode($trip['pricing_tiers'], true) : [];
    $totalAmount = 0;

    foreach ($passengers as $p) {
        $tierName = $p['tierName'] ?? '';
        $price = (float) $trip['price'];
        if (!empty($tierName) && !empty($pricingTiers)) {
            foreach ($pricingTiers as $tier) {
                if (($tier['name'] ?? '') === $tierName) {
                    $price = (float) ($tier['price'] ?? $trip['price']);
                    break;
                }
            }
        }
        $totalAmount += $price;
    }

    // Handle coupon
    $discountAmount = 0;
    $couponId = null;

    if (!empty($couponCode)) {
        $stmt = $pdo->prepare("
            SELECT * FROM coupons
            WHERE code = ? AND is_active = 1
              AND (valid_from IS NULL OR valid_from <= NOW())
              AND (valid_until IS NULL OR valid_until >= NOW())
              AND (max_uses IS NULL OR current_uses < max_uses)
        ");
        $stmt->execute([$couponCode]);
        $coupon = $stmt->fetch();

        if ($coupon) {
            if ($coupon['min_order_amount'] && $totalAmount < (float) $coupon['min_order_amount']) {
                // Don't apply coupon but don't error either
            } else {
                $couponId = $coupon['id'];
                if ($coupon['discount_type'] === 'PERCENTAGE') {
                    $discountAmount = round($totalAmount * (float) $coupon['discount_value'] / 100, 2);
                } else {
                    $discountAmount = min((float) $coupon['discount_value'], $totalAmount);
                }
                // Increment usage
                $pdo->prepare('UPDATE coupons SET current_uses = current_uses + 1 WHERE id = ?')->execute([$coupon['id']]);
            }
        }
    }

    $finalAmount = max(0, $totalAmount - $discountAmount);

    // Handle guest booker
    $guestBookerId = null;
    $userId = $user ? $user['id'] : null;

    if (!$user && $guestData) {
        $guestEmail     = sanitizeString($guestData['email'] ?? '');
        $guestPhone     = sanitizeString($guestData['phone'] ?? '');
        $guestFirstName = sanitizeString($guestData['firstName'] ?? '');
        $guestLastName  = sanitizeString($guestData['lastName'] ?? '');

        if (empty($guestEmail) || empty($guestFirstName) || empty($guestLastName)) {
            jsonError('Guest contact information is required', 400);
        }

        $guestBookerId = uuid();
        $stmt = $pdo->prepare('INSERT INTO guest_bookers (id, first_name, last_name, email, phone, created_at) VALUES (?, ?, ?, ?, ?, NOW())');
        $stmt->execute([$guestBookerId, $guestFirstName, $guestLastName, $guestEmail, $guestPhone]);
    } elseif (!$user) {
        jsonError('Authentication or guest information is required', 400);
    }

    // Create booking
    $bookingId = uuid();
    $bookingNumber = generateBookingNumber();

    $stmt = $pdo->prepare("
        INSERT INTO bookings (id, booking_number, trip_id, user_id, guest_booker_id, status,
                              number_of_persons, total_amount, discount_amount, final_amount,
                              coupon_id, special_requests, notes, passengers_data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    ");
    $stmt->execute([
        $bookingId,
        $bookingNumber,
        $tripId,
        $userId,
        $guestBookerId,
        $numPersons,
        $totalAmount,
        $discountAmount,
        $finalAmount,
        $couponId,
        $specialRequests ?: null,
        null,
        json_encode($passengers, JSON_UNESCAPED_UNICODE),
    ]);

    // Create notification for user
    if ($userId) {
        $notifId = uuid();
        $pdo->prepare("
            INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at)
            VALUES (?, ?, ?, ?, 'BOOKING_CONFIRMATION', 0, NOW())
        ")->execute([$notifId, $userId, 'تأكيد الحجز', "تم إنشاء حجزك رقم {$bookingNumber} بنجاح"]);
    }

    jsonResponse([
        'id'            => $bookingId,
        'bookingNumber' => $bookingNumber,
        'status'        => 'PENDING',
        'totalAmount'   => $totalAmount,
        'discountAmount'=> $discountAmount,
        'finalAmount'   => $finalAmount,
        'paymentUrl'    => null, // Payment handled separately
    ], 201);
}

/**
 * GET /bookings/my - Get authenticated user's bookings.
 */
function getMyBookings($params): void {
    $user = authenticate();
    $pdo = db();

    $stmt = $pdo->prepare("
        SELECT b.id, b.booking_number, b.status, b.number_of_persons, b.final_amount,
               b.created_at, b.total_amount, b.discount_amount, b.special_requests,
               t.title AS trip_title, t.destination AS trip_destination,
               t.departure_date AS trip_departure_date,
               (SELECT p.status FROM payments p WHERE p.booking_id = b.id ORDER BY p.created_at DESC LIMIT 1) AS payment_status
        FROM bookings b
        JOIN trips t ON t.id = b.trip_id
        WHERE b.user_id = ?
        ORDER BY b.created_at DESC
    ");
    $stmt->execute([$user['id']]);
    $rows = $stmt->fetchAll();

    $bookings = array_map(function ($r) {
        return [
            'id'                => $r['id'],
            'bookingNumber'     => $r['booking_number'],
            'tripTitle'         => $r['trip_title'],
            'tripDestination'   => $r['trip_destination'],
            'tripDepartureDate' => $r['trip_departure_date'],
            'status'            => $r['status'],
            'numberOfPersons'   => (int) $r['number_of_persons'],
            'totalAmount'       => (float) $r['total_amount'],
            'discountAmount'    => (float) $r['discount_amount'],
            'finalAmount'       => (float) $r['final_amount'],
            'paymentStatus'     => $r['payment_status'],
            'specialRequests'   => $r['special_requests'],
            'createdAt'         => $r['created_at'],
        ];
    }, $rows);

    jsonResponse(['bookings' => $bookings]);
}

/**
 * GET /bookings/lookup - Lookup guest booking by booking_number and email.
 */
function lookupGuestBooking($params): void {
    $bookingNumber = $_GET['bookingNumber'] ?? '';
    $email = $_GET['email'] ?? '';

    if (empty($bookingNumber) || empty($email)) {
        jsonError('Booking number and email are required', 400);
    }

    $pdo = db();
    $stmt = $pdo->prepare("
        SELECT b.*, t.title AS trip_title, t.destination AS trip_destination,
               t.departure_date AS trip_departure_date,
               g.first_name AS guest_first_name, g.last_name AS guest_last_name, g.email AS guest_email,
               (SELECT p.status FROM payments p WHERE p.booking_id = b.id ORDER BY p.created_at DESC LIMIT 1) AS payment_status
        FROM bookings b
        JOIN trips t ON t.id = b.trip_id
        JOIN guest_bookers g ON g.id = b.guest_booker_id
        WHERE b.booking_number = ? AND g.email = ?
    ");
    $stmt->execute([$bookingNumber, $email]);
    $booking = $stmt->fetch();

    if (!$booking) {
        jsonError('Booking not found', 404);
    }

    jsonResponse([
        'booking' => [
            'id'                => $booking['id'],
            'bookingNumber'     => $booking['booking_number'],
            'tripTitle'         => $booking['trip_title'],
            'tripDestination'   => $booking['trip_destination'],
            'tripDepartureDate' => $booking['trip_departure_date'],
            'status'            => $booking['status'],
            'numberOfPersons'   => (int) $booking['number_of_persons'],
            'finalAmount'       => (float) $booking['final_amount'],
            'paymentStatus'     => $booking['payment_status'],
            'createdAt'         => $booking['created_at'],
            'guest' => [
                'firstName' => $booking['guest_first_name'],
                'lastName'  => $booking['guest_last_name'],
                'email'     => $booking['guest_email'],
            ],
        ],
    ]);
}

/**
 * GET /bookings/{id} - Get booking detail for authenticated user.
 */
function getBookingDetail($params): void {
    $user = authenticate();
    $bookingId = $params['id'] ?? '';
    $pdo = db();

    $stmt = $pdo->prepare("
        SELECT b.*, t.title AS trip_title, t.destination AS trip_destination,
               t.departure_date AS trip_departure_date,
               c.code AS coupon_code, c.discount_type, c.discount_value,
               (SELECT p.status FROM payments p WHERE p.booking_id = b.id ORDER BY p.created_at DESC LIMIT 1) AS payment_status
        FROM bookings b
        JOIN trips t ON t.id = b.trip_id
        LEFT JOIN coupons c ON c.id = b.coupon_id
        WHERE b.id = ? AND b.user_id = ?
    ");
    $stmt->execute([$bookingId, $user['id']]);
    $booking = $stmt->fetch();

    if (!$booking) {
        jsonError('Booking not found', 404);
    }

    $passengers = $booking['passengers_data'] ? json_decode($booking['passengers_data'], true) : [];

    $coupon = null;
    if ($booking['coupon_code']) {
        $coupon = [
            'code'            => $booking['coupon_code'],
            'discountPercent' => $booking['discount_type'] === 'PERCENTAGE' ? (float) $booking['discount_value'] : null,
            'discountAmount'  => $booking['discount_type'] === 'FIXED' ? (float) $booking['discount_value'] : null,
        ];
    }

    jsonResponse([
        'booking' => [
            'id'                => $booking['id'],
            'bookingNumber'     => $booking['booking_number'],
            'tripTitle'         => $booking['trip_title'],
            'tripDestination'   => $booking['trip_destination'],
            'tripDepartureDate' => $booking['trip_departure_date'],
            'status'            => $booking['status'],
            'numberOfPersons'   => (int) $booking['number_of_persons'],
            'totalAmount'       => (float) $booking['total_amount'],
            'discountAmount'    => (float) $booking['discount_amount'],
            'finalAmount'       => (float) $booking['final_amount'],
            'specialRequests'   => $booking['special_requests'],
            'paymentStatus'     => $booking['payment_status'],
            'passengers'        => $passengers,
            'coupon'            => $coupon,
            'confirmedAt'       => $booking['confirmed_at'],
            'cancelledAt'       => $booking['cancelled_at'],
            'createdAt'         => $booking['created_at'],
        ],
    ]);
}

/**
 * PATCH /bookings/{id}/cancel - Cancel own booking.
 */
function cancelMyBooking($params): void {
    $user = authenticate();
    $bookingId = $params['id'] ?? '';
    $pdo = db();

    $stmt = $pdo->prepare("SELECT id, status FROM bookings WHERE id = ? AND user_id = ?");
    $stmt->execute([$bookingId, $user['id']]);
    $booking = $stmt->fetch();

    if (!$booking) {
        jsonError('Booking not found', 404);
    }

    if ($booking['status'] !== 'PENDING') {
        jsonError('Only pending bookings can be cancelled', 400);
    }

    $stmt = $pdo->prepare("UPDATE bookings SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW() WHERE id = ?");
    $stmt->execute([$bookingId]);

    jsonResponse(['message' => 'Booking cancelled successfully']);
}
