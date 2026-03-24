<?php

/**
 * GET /admin/dashboard - Dashboard overview stats.
 */
function getDashboardOverview($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN', 'EMPLOYEE');

    $pdo = db();

    $totalTrips = (int) $pdo->query("SELECT COUNT(*) FROM trips WHERE status != 'CANCELLED'")->fetchColumn();
    $totalBookings = (int) $pdo->query("SELECT COUNT(*) FROM bookings")->fetchColumn();
    $totalRevenue = (float) $pdo->query("SELECT COALESCE(SUM(final_amount), 0) FROM bookings WHERE status IN ('CONFIRMED','COMPLETED')")->fetchColumn();
    $totalCustomers = (int) $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'CUSTOMER'")->fetchColumn();
    $pendingBookings = (int) $pdo->query("SELECT COUNT(*) FROM bookings WHERE status = 'PENDING'")->fetchColumn();
    $activeTrips = (int) $pdo->query("SELECT COUNT(*) FROM trips WHERE status = 'PUBLISHED' AND departure_date >= CURDATE()")->fetchColumn();

    // Recent bookings
    $stmt = $pdo->query("
        SELECT b.id, b.booking_number, b.status, b.final_amount, b.created_at,
               t.title AS trip_title,
               COALESCE(CONCAT(u.first_name, ' ', u.last_name), CONCAT(g.first_name, ' ', g.last_name)) AS customer_name
        FROM bookings b
        JOIN trips t ON t.id = b.trip_id
        LEFT JOIN users u ON u.id = b.user_id
        LEFT JOIN guest_bookers g ON g.id = b.guest_booker_id
        ORDER BY b.created_at DESC LIMIT 5
    ");
    $recentBookings = array_map(function ($r) {
        return [
            'id'            => $r['id'],
            'bookingNumber' => $r['booking_number'],
            'status'        => $r['status'],
            'finalAmount'   => (float) $r['final_amount'],
            'tripTitle'     => $r['trip_title'],
            'customerName'  => $r['customer_name'],
            'createdAt'     => $r['created_at'],
        ];
    }, $stmt->fetchAll());

    // Monthly revenue (last 6 months)
    $stmt = $pdo->query("
        SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, SUM(final_amount) AS revenue
        FROM bookings WHERE status IN ('CONFIRMED','COMPLETED')
        GROUP BY month ORDER BY month DESC LIMIT 6
    ");
    $monthlyRevenue = $stmt->fetchAll();

    jsonResponse([
        'stats' => [
            'totalTrips'      => $totalTrips,
            'totalBookings'   => $totalBookings,
            'totalRevenue'    => $totalRevenue,
            'totalCustomers'  => $totalCustomers,
            'pendingBookings' => $pendingBookings,
            'activeTrips'     => $activeTrips,
        ],
        'recentBookings' => $recentBookings,
        'monthlyRevenue' => $monthlyRevenue,
    ]);
}

/**
 * GET /admin/trips - List ALL trips with pagination.
 */
function adminGetTrips($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN', 'EMPLOYEE');

    $pdo = db();
    [$offset, $limit, $page] = paginationParams();

    $search = $_GET['search'] ?? '';
    $status = $_GET['status'] ?? '';

    $where = ['1=1'];
    $bindings = [];

    if (!empty($search)) {
        $where[] = "(t.title LIKE ? OR t.destination LIKE ?)";
        $bindings[] = "%{$search}%";
        $bindings[] = "%{$search}%";
    }
    if (!empty($status)) {
        $where[] = "t.status = ?";
        $bindings[] = $status;
    }

    $whereClause = implode(' AND ', $where);

    $countSql = "SELECT COUNT(*) FROM trips t WHERE {$whereClause}";
    $stmt = $pdo->prepare($countSql);
    $stmt->execute($bindings);
    $total = (int) $stmt->fetchColumn();

    $sql = "
        SELECT t.*,
               (SELECT ti.image_url FROM trip_images ti WHERE ti.trip_id = t.id ORDER BY ti.sort_order ASC LIMIT 1) AS primary_image,
               (SELECT COUNT(*) FROM bookings b WHERE b.trip_id = t.id AND b.status IN ('CONFIRMED','COMPLETED')) AS bookings_count
        FROM trips t
        WHERE {$whereClause}
        ORDER BY t.created_at DESC
        LIMIT ? OFFSET ?
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute(array_merge($bindings, [$limit, $offset]));
    $rows = $stmt->fetchAll();

    $trips = array_map(function ($r) {
        return [
            'id'             => $r['id'],
            'title'          => $r['title'],
            'slug'           => $r['slug'],
            'destination'    => $r['destination'],
            'departureDate'  => $r['departure_date'],
            'returnDate'     => $r['return_date'],
            'duration'       => (int) $r['duration_days'],
            'pricePerPerson' => (float) $r['price'],
            'totalSeats'     => (int) $r['max_persons'],
            'availableSeats' => max(0, (int) $r['max_persons'] - (int) $r['bookings_count']),
            'bookingsCount'  => (int) $r['bookings_count'],
            'isFeatured'     => (bool) $r['is_featured'],
            'status'         => $r['status'],
            'category'       => $r['category'],
            'primaryImage'   => $r['primary_image'],
            'createdAt'      => $r['created_at'],
        ];
    }, $rows);

    jsonResponse([
        'trips' => $trips,
        'pagination' => [
            'page'       => $page,
            'limit'      => $limit,
            'total'      => $total,
            'totalPages' => (int) ceil($total / $limit),
        ],
    ]);
}

/**
 * GET /admin/trips/{id} - Get trip by ID with images.
 */
function adminGetTripById($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN', 'EMPLOYEE');

    $tripId = $params['id'] ?? '';
    $pdo = db();

    $stmt = $pdo->prepare("
        SELECT t.*,
            (SELECT COUNT(*) FROM bookings b WHERE b.trip_id = t.id AND b.status IN ('CONFIRMED','COMPLETED')) AS bookings_count
        FROM trips t WHERE t.id = ?
    ");
    $stmt->execute([$tripId]);
    $trip = $stmt->fetch();

    if (!$trip) {
        jsonError('Trip not found', 404);
    }

    $stmt = $pdo->prepare('SELECT id, image_url, alt_text, sort_order FROM trip_images WHERE trip_id = ? ORDER BY sort_order ASC');
    $stmt->execute([$tripId]);
    $images = $stmt->fetchAll();

    $imageList = array_map(function ($img, $i) {
        return [
            'id'        => $img['id'],
            'url'       => $img['image_url'],
            'altText'   => $img['alt_text'],
            'sortOrder' => (int) $img['sort_order'],
            'isPrimary' => $i === 0,
        ];
    }, $images, array_keys($images));

    $includes = $trip['includes'] ? json_decode($trip['includes'], true) : [];
    $excludes = $trip['excludes'] ? json_decode($trip['excludes'], true) : [];
    $itinerary = $trip['itinerary'] ? json_decode($trip['itinerary'], true) : [];
    $pricingTiers = $trip['pricing_tiers'] ? json_decode($trip['pricing_tiers'], true) : [];

    jsonResponse([
        'trip' => [
            'id'               => $trip['id'],
            'title'            => $trip['title'],
            'slug'             => $trip['slug'],
            'description'      => $trip['description'],
            'shortDescription' => $trip['short_description'],
            'destination'      => $trip['destination'],
            'departureCity'    => $trip['departure_city'],
            'departureDate'    => $trip['departure_date'],
            'returnDate'       => $trip['return_date'],
            'duration'         => (int) $trip['duration_days'],
            'pricePerPerson'   => (float) $trip['price'],
            'childPrice'       => $trip['child_price'] ? (float) $trip['child_price'] : null,
            'totalSeats'       => (int) $trip['max_persons'],
            'availableSeats'   => max(0, (int) $trip['max_persons'] - (int) $trip['bookings_count']),
            'isFeatured'       => (bool) $trip['is_featured'],
            'status'           => $trip['status'],
            'category'         => $trip['category'],
            'inclusions'       => $includes,
            'exclusions'       => $excludes,
            'itinerary'        => $itinerary,
            'pricingTiers'     => $pricingTiers,
            'meetingPoint'     => $trip['meeting_point'],
            'meetingTime'      => $trip['meeting_time'],
            'terms'            => $trip['terms'],
            'images'           => $imageList,
            'primaryImage'     => !empty($imageList) ? $imageList[0]['url'] : null,
            'createdAt'        => $trip['created_at'],
            'updatedAt'        => $trip['updated_at'],
        ],
    ]);
}

/**
 * POST /admin/trips/{id}/images - Add images (alias for addTripImages).
 */
function adminAddTripImages($params): void {
    addTripImages($params);
}

/**
 * GET /admin/bookings - List all bookings with filters.
 */
function adminGetBookings($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN', 'EMPLOYEE');

    $pdo = db();
    [$offset, $limit, $page] = paginationParams();

    $search = $_GET['search'] ?? '';
    $status = $_GET['status'] ?? '';

    $where = ['1=1'];
    $bindings = [];

    if (!empty($search)) {
        $where[] = "(b.booking_number LIKE ? OR t.title LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)";
        $bindings = array_merge($bindings, array_fill(0, 5, "%{$search}%"));
    }
    if (!empty($status)) {
        $where[] = "b.status = ?";
        $bindings[] = $status;
    }

    $whereClause = implode(' AND ', $where);

    $countSql = "
        SELECT COUNT(*) FROM bookings b
        JOIN trips t ON t.id = b.trip_id
        LEFT JOIN users u ON u.id = b.user_id
        WHERE {$whereClause}
    ";
    $stmt = $pdo->prepare($countSql);
    $stmt->execute($bindings);
    $total = (int) $stmt->fetchColumn();

    $sql = "
        SELECT b.id, b.booking_number, b.status, b.number_of_persons, b.total_amount,
               b.discount_amount, b.final_amount, b.created_at, b.confirmed_at, b.cancelled_at,
               t.title AS trip_title, t.destination AS trip_destination, t.departure_date AS trip_departure_date,
               COALESCE(CONCAT(u.first_name, ' ', u.last_name), CONCAT(g.first_name, ' ', g.last_name)) AS customer_name,
               COALESCE(u.email, g.email) AS customer_email,
               (SELECT p.status FROM payments p WHERE p.booking_id = b.id ORDER BY p.created_at DESC LIMIT 1) AS payment_status
        FROM bookings b
        JOIN trips t ON t.id = b.trip_id
        LEFT JOIN users u ON u.id = b.user_id
        LEFT JOIN guest_bookers g ON g.id = b.guest_booker_id
        WHERE {$whereClause}
        ORDER BY b.created_at DESC
        LIMIT ? OFFSET ?
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute(array_merge($bindings, [$limit, $offset]));
    $rows = $stmt->fetchAll();

    $bookings = array_map(function ($r) {
        return [
            'id'                => $r['id'],
            'bookingNumber'     => $r['booking_number'],
            'status'            => $r['status'],
            'numberOfPersons'   => (int) $r['number_of_persons'],
            'totalAmount'       => (float) $r['total_amount'],
            'discountAmount'    => (float) $r['discount_amount'],
            'finalAmount'       => (float) $r['final_amount'],
            'tripTitle'         => $r['trip_title'],
            'tripDestination'   => $r['trip_destination'],
            'tripDepartureDate' => $r['trip_departure_date'],
            'customerName'      => $r['customer_name'],
            'customerEmail'     => $r['customer_email'],
            'paymentStatus'     => $r['payment_status'],
            'confirmedAt'       => $r['confirmed_at'],
            'cancelledAt'       => $r['cancelled_at'],
            'createdAt'         => $r['created_at'],
        ];
    }, $rows);

    jsonResponse([
        'bookings' => $bookings,
        'pagination' => [
            'page'       => $page,
            'limit'      => $limit,
            'total'      => $total,
            'totalPages' => (int) ceil($total / $limit),
        ],
    ]);
}

/**
 * GET /admin/bookings/{id} - Get booking detail.
 */
function adminGetBookingDetail($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN', 'EMPLOYEE');

    $bookingId = $params['id'] ?? '';
    $pdo = db();

    $stmt = $pdo->prepare("
        SELECT b.*, t.title AS trip_title, t.destination AS trip_destination,
               t.departure_date AS trip_departure_date, t.slug AS trip_slug,
               COALESCE(CONCAT(u.first_name, ' ', u.last_name), CONCAT(g.first_name, ' ', g.last_name)) AS customer_name,
               COALESCE(u.email, g.email) AS customer_email,
               COALESCE(u.phone, g.phone) AS customer_phone,
               c.code AS coupon_code, c.discount_type, c.discount_value,
               (SELECT p.status FROM payments p WHERE p.booking_id = b.id ORDER BY p.created_at DESC LIMIT 1) AS payment_status
        FROM bookings b
        JOIN trips t ON t.id = b.trip_id
        LEFT JOIN users u ON u.id = b.user_id
        LEFT JOIN guest_bookers g ON g.id = b.guest_booker_id
        LEFT JOIN coupons c ON c.id = b.coupon_id
        WHERE b.id = ?
    ");
    $stmt->execute([$bookingId]);
    $booking = $stmt->fetch();

    if (!$booking) {
        jsonError('Booking not found', 404);
    }

    $passengers = $booking['passengers_data'] ? json_decode($booking['passengers_data'], true) : [];

    jsonResponse([
        'booking' => [
            'id'                => $booking['id'],
            'bookingNumber'     => $booking['booking_number'],
            'status'            => $booking['status'],
            'numberOfPersons'   => (int) $booking['number_of_persons'],
            'totalAmount'       => (float) $booking['total_amount'],
            'discountAmount'    => (float) $booking['discount_amount'],
            'finalAmount'       => (float) $booking['final_amount'],
            'specialRequests'   => $booking['special_requests'],
            'notes'             => $booking['notes'],
            'tripTitle'         => $booking['trip_title'],
            'tripDestination'   => $booking['trip_destination'],
            'tripDepartureDate' => $booking['trip_departure_date'],
            'tripSlug'          => $booking['trip_slug'],
            'customerName'      => $booking['customer_name'],
            'customerEmail'     => $booking['customer_email'],
            'customerPhone'     => $booking['customer_phone'],
            'paymentStatus'     => $booking['payment_status'],
            'couponCode'        => $booking['coupon_code'],
            'passengers'        => $passengers,
            'confirmedAt'       => $booking['confirmed_at'],
            'cancelledAt'       => $booking['cancelled_at'],
            'createdAt'         => $booking['created_at'],
        ],
    ]);
}

/**
 * POST /admin/bookings/{id}/confirm - Confirm booking.
 */
function adminConfirmBooking($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN', 'EMPLOYEE');

    $bookingId = $params['id'] ?? '';
    $pdo = db();

    $stmt = $pdo->prepare("UPDATE bookings SET status = 'CONFIRMED', confirmed_at = NOW(), updated_at = NOW() WHERE id = ? AND status = 'PENDING'");
    $stmt->execute([$bookingId]);

    if ($stmt->rowCount() === 0) {
        jsonError('Booking not found or cannot be confirmed', 404);
    }

    // Notify user
    $stmt = $pdo->prepare('SELECT user_id, booking_number FROM bookings WHERE id = ?');
    $stmt->execute([$bookingId]);
    $booking = $stmt->fetch();
    if ($booking && $booking['user_id']) {
        $pdo->prepare("INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, 'BOOKING_CONFIRMED', 0, NOW())")
            ->execute([uuid(), $booking['user_id'], 'تم تأكيد حجزك', "تم تأكيد الحجز رقم {$booking['booking_number']}"]);
    }

    jsonResponse(['message' => 'Booking confirmed']);
}

/**
 * POST /admin/bookings/{id}/cancel - Cancel booking.
 */
function adminCancelBooking($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN', 'EMPLOYEE');

    $bookingId = $params['id'] ?? '';
    $pdo = db();

    $stmt = $pdo->prepare("UPDATE bookings SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW() WHERE id = ?");
    $stmt->execute([$bookingId]);

    if ($stmt->rowCount() === 0) {
        jsonError('Booking not found', 404);
    }

    $stmt = $pdo->prepare('SELECT user_id, booking_number FROM bookings WHERE id = ?');
    $stmt->execute([$bookingId]);
    $booking = $stmt->fetch();
    if ($booking && $booking['user_id']) {
        $pdo->prepare("INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, 'BOOKING_CANCELLED', 0, NOW())")
            ->execute([uuid(), $booking['user_id'], 'تم إلغاء حجزك', "تم إلغاء الحجز رقم {$booking['booking_number']}"]);
    }

    jsonResponse(['message' => 'Booking cancelled']);
}

/**
 * POST /admin/bookings/{id}/complete - Complete booking.
 */
function adminCompleteBooking($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN', 'EMPLOYEE');

    $bookingId = $params['id'] ?? '';
    $pdo = db();

    $stmt = $pdo->prepare("UPDATE bookings SET status = 'COMPLETED', updated_at = NOW() WHERE id = ? AND status = 'CONFIRMED'");
    $stmt->execute([$bookingId]);

    if ($stmt->rowCount() === 0) {
        jsonError('Booking not found or cannot be completed', 404);
    }

    jsonResponse(['message' => 'Booking completed']);
}

/**
 * PATCH /admin/bookings/{id}/status - Update booking status.
 */
function adminUpdateBookingStatus($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN', 'EMPLOYEE');

    $bookingId = $params['id'] ?? '';
    $body = getJsonBody();
    $newStatus = $body['status'] ?? '';

    $validStatuses = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'REFUNDED'];
    if (!in_array($newStatus, $validStatuses)) {
        jsonError('Invalid status', 400);
    }

    $pdo = db();
    $sets = ["status = ?", "updated_at = NOW()"];
    $bindings = [$newStatus];

    if ($newStatus === 'CONFIRMED') {
        $sets[] = "confirmed_at = NOW()";
    } elseif ($newStatus === 'CANCELLED') {
        $sets[] = "cancelled_at = NOW()";
    }

    $bindings[] = $bookingId;
    $sql = "UPDATE bookings SET " . implode(', ', $sets) . " WHERE id = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($bindings);

    if ($stmt->rowCount() === 0) {
        jsonError('Booking not found', 404);
    }

    jsonResponse(['message' => 'Booking status updated']);
}

/**
 * GET /admin/customers - List customers.
 */
function adminGetCustomers($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN', 'EMPLOYEE');

    $pdo = db();
    [$offset, $limit, $page] = paginationParams();
    $search = $_GET['search'] ?? '';

    $where = ["u.role = 'CUSTOMER'"];
    $bindings = [];

    if (!empty($search)) {
        $where[] = "(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)";
        $bindings = array_merge($bindings, array_fill(0, 4, "%{$search}%"));
    }

    $whereClause = implode(' AND ', $where);

    $total = (int) $pdo->prepare("SELECT COUNT(*) FROM users u WHERE {$whereClause}")->execute($bindings) ?
        $pdo->prepare("SELECT COUNT(*) FROM users u WHERE {$whereClause}") : null;
    $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM users u WHERE {$whereClause}");
    $stmtCount->execute($bindings);
    $total = (int) $stmtCount->fetchColumn();

    $sql = "
        SELECT u.id, u.email, u.phone, u.first_name, u.last_name, u.is_active, u.last_login_at, u.created_at,
               (SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.id) AS bookings_count,
               (SELECT COALESCE(SUM(b2.final_amount), 0) FROM bookings b2 WHERE b2.user_id = u.id AND b2.status IN ('CONFIRMED','COMPLETED')) AS total_spent
        FROM users u
        WHERE {$whereClause}
        ORDER BY u.created_at DESC
        LIMIT ? OFFSET ?
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute(array_merge($bindings, [$limit, $offset]));
    $rows = $stmt->fetchAll();

    $customers = array_map(function ($r) {
        return [
            'id'            => $r['id'],
            'email'         => $r['email'],
            'phone'         => $r['phone'],
            'firstName'     => $r['first_name'],
            'lastName'      => $r['last_name'],
            'isActive'      => (bool) $r['is_active'],
            'lastLoginAt'   => $r['last_login_at'],
            'bookingsCount' => (int) $r['bookings_count'],
            'totalSpent'    => (float) $r['total_spent'],
            'createdAt'     => $r['created_at'],
        ];
    }, $rows);

    jsonResponse([
        'customers' => $customers,
        'pagination' => [
            'page'       => $page,
            'limit'      => $limit,
            'total'      => $total,
            'totalPages' => (int) ceil($total / $limit),
        ],
    ]);
}

/**
 * GET /admin/customers/{id} - Customer detail with bookings.
 */
function adminGetCustomerDetail($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN', 'EMPLOYEE');

    $customerId = $params['id'] ?? '';
    $pdo = db();

    $stmt = $pdo->prepare("SELECT id, email, phone, first_name, last_name, is_active, avatar_url, last_login_at, created_at FROM users WHERE id = ? AND role = 'CUSTOMER'");
    $stmt->execute([$customerId]);
    $customer = $stmt->fetch();

    if (!$customer) {
        jsonError('Customer not found', 404);
    }

    $stmt = $pdo->prepare("
        SELECT b.id, b.booking_number, b.status, b.final_amount, b.created_at,
               t.title AS trip_title
        FROM bookings b
        JOIN trips t ON t.id = b.trip_id
        WHERE b.user_id = ?
        ORDER BY b.created_at DESC
    ");
    $stmt->execute([$customerId]);
    $bookings = $stmt->fetchAll();

    jsonResponse([
        'customer' => [
            'id'          => $customer['id'],
            'email'       => $customer['email'],
            'phone'       => $customer['phone'],
            'firstName'   => $customer['first_name'],
            'lastName'    => $customer['last_name'],
            'isActive'    => (bool) $customer['is_active'],
            'avatarUrl'   => $customer['avatar_url'],
            'lastLoginAt' => $customer['last_login_at'],
            'createdAt'   => $customer['created_at'],
        ],
        'bookings' => array_map(function ($b) {
            return [
                'id'            => $b['id'],
                'bookingNumber' => $b['booking_number'],
                'status'        => $b['status'],
                'finalAmount'   => (float) $b['final_amount'],
                'tripTitle'     => $b['trip_title'],
                'createdAt'     => $b['created_at'],
            ];
        }, $bookings),
    ]);
}

/**
 * PUT /admin/customers/{id}/toggle-status - Toggle active status.
 */
function adminToggleCustomerStatus($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN');

    $customerId = $params['id'] ?? '';
    $pdo = db();

    $stmt = $pdo->prepare("UPDATE users SET is_active = NOT is_active, updated_at = NOW() WHERE id = ? AND role = 'CUSTOMER'");
    $stmt->execute([$customerId]);

    if ($stmt->rowCount() === 0) {
        jsonError('Customer not found', 404);
    }

    $stmt = $pdo->prepare('SELECT is_active FROM users WHERE id = ?');
    $stmt->execute([$customerId]);
    $isActive = (bool) $stmt->fetchColumn();

    jsonResponse(['message' => 'Customer status updated', 'isActive' => $isActive]);
}

/**
 * GET /admin/coupons - List all coupons.
 */
function adminGetCoupons($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN', 'EMPLOYEE');

    $pdo = db();
    $stmt = $pdo->query("SELECT * FROM coupons ORDER BY created_at DESC");
    $coupons = array_map(function ($c) {
        return [
            'id'            => $c['id'],
            'code'          => $c['code'],
            'discountType'  => $c['discount_type'],
            'discountValue' => (float) $c['discount_value'],
            'minOrderAmount'=> $c['min_order_amount'] ? (float) $c['min_order_amount'] : null,
            'maxUses'       => $c['max_uses'] ? (int) $c['max_uses'] : null,
            'currentUses'   => (int) $c['current_uses'],
            'validFrom'     => $c['valid_from'],
            'validUntil'    => $c['valid_until'],
            'isActive'      => (bool) $c['is_active'],
            'createdAt'     => $c['created_at'],
        ];
    }, $stmt->fetchAll());

    jsonResponse(['coupons' => $coupons]);
}

/**
 * POST /admin/coupons - Create coupon.
 */
function adminCreateCoupon($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN', 'EMPLOYEE');

    $body = getJsonBody();
    $pdo = db();

    $code = strtoupper(sanitizeString($body['code'] ?? ''));
    if (empty($code)) {
        jsonError('Coupon code is required', 400);
    }

    // Check uniqueness
    $stmt = $pdo->prepare('SELECT id FROM coupons WHERE code = ?');
    $stmt->execute([$code]);
    if ($stmt->fetch()) {
        jsonError('Coupon code already exists', 409);
    }

    $id = uuid();
    $stmt = $pdo->prepare("
        INSERT INTO coupons (id, code, discount_type, discount_value, min_order_amount, max_uses, current_uses, valid_from, valid_until, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, NOW(), NOW())
    ");
    $stmt->execute([
        $id,
        $code,
        $body['discountType'] ?? 'PERCENTAGE',
        (float) ($body['discountValue'] ?? 0),
        isset($body['minOrderAmount']) ? (float) $body['minOrderAmount'] : null,
        isset($body['maxUses']) ? (int) $body['maxUses'] : null,
        $body['validFrom'] ?? null,
        $body['validUntil'] ?? null,
        isset($body['isActive']) ? (int) $body['isActive'] : 1,
    ]);

    jsonResponse(['id' => $id, 'message' => 'Coupon created'], 201);
}

/**
 * PUT /admin/coupons/{id} - Update coupon.
 */
function adminUpdateCoupon($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN', 'EMPLOYEE');

    $couponId = $params['id'] ?? '';
    $body = getJsonBody();
    $pdo = db();

    $fields = [];
    $bindings = [];

    if (array_key_exists('code', $body)) { $fields[] = 'code = ?'; $bindings[] = strtoupper(sanitizeString($body['code'])); }
    if (array_key_exists('discountType', $body)) { $fields[] = 'discount_type = ?'; $bindings[] = $body['discountType']; }
    if (array_key_exists('discountValue', $body)) { $fields[] = 'discount_value = ?'; $bindings[] = (float) $body['discountValue']; }
    if (array_key_exists('minOrderAmount', $body)) { $fields[] = 'min_order_amount = ?'; $bindings[] = $body['minOrderAmount'] !== null ? (float) $body['minOrderAmount'] : null; }
    if (array_key_exists('maxUses', $body)) { $fields[] = 'max_uses = ?'; $bindings[] = $body['maxUses'] !== null ? (int) $body['maxUses'] : null; }
    if (array_key_exists('validFrom', $body)) { $fields[] = 'valid_from = ?'; $bindings[] = $body['validFrom']; }
    if (array_key_exists('validUntil', $body)) { $fields[] = 'valid_until = ?'; $bindings[] = $body['validUntil']; }
    if (array_key_exists('isActive', $body)) { $fields[] = 'is_active = ?'; $bindings[] = (int) $body['isActive']; }

    if (empty($fields)) {
        jsonError('No fields to update', 400);
    }

    $fields[] = 'updated_at = NOW()';
    $bindings[] = $couponId;

    $sql = "UPDATE coupons SET " . implode(', ', $fields) . " WHERE id = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($bindings);

    if ($stmt->rowCount() === 0) {
        jsonError('Coupon not found', 404);
    }

    jsonResponse(['message' => 'Coupon updated']);
}

/**
 * DELETE /admin/coupons/{id} - Delete coupon.
 */
function adminDeleteCoupon($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN', 'EMPLOYEE');

    $couponId = $params['id'] ?? '';
    $pdo = db();

    $stmt = $pdo->prepare('DELETE FROM coupons WHERE id = ?');
    $stmt->execute([$couponId]);

    if ($stmt->rowCount() === 0) {
        jsonError('Coupon not found', 404);
    }

    jsonResponse(['message' => 'Coupon deleted']);
}

/**
 * POST /admin/refunds - Process refund.
 */
function adminRefund($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN');

    $body = getJsonBody();
    $bookingId = $body['bookingId'] ?? '';

    if (empty($bookingId)) {
        jsonError('Booking ID is required', 400);
    }

    $pdo = db();

    $stmt = $pdo->prepare("UPDATE bookings SET status = 'REFUNDED', updated_at = NOW() WHERE id = ?");
    $stmt->execute([$bookingId]);

    if ($stmt->rowCount() === 0) {
        jsonError('Booking not found', 404);
    }

    // Update payment status
    $pdo->prepare("UPDATE payments SET status = 'refunded', updated_at = NOW() WHERE booking_id = ?")->execute([$bookingId]);

    // Notify user
    $stmt = $pdo->prepare('SELECT user_id, booking_number FROM bookings WHERE id = ?');
    $stmt->execute([$bookingId]);
    $booking = $stmt->fetch();
    if ($booking && $booking['user_id']) {
        $pdo->prepare("INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, 'REFUND', 0, NOW())")
            ->execute([uuid(), $booking['user_id'], 'تم استرداد المبلغ', "تم استرداد مبلغ الحجز رقم {$booking['booking_number']}"]);
    }

    jsonResponse(['message' => 'Refund processed']);
}
