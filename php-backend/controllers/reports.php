<?php

/**
 * GET /admin/reports - Overview stats.
 */
function getReportsOverview($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN', 'EMPLOYEE');

    $pdo = db();

    $totalRevenue = (float) $pdo->query("SELECT COALESCE(SUM(final_amount), 0) FROM bookings WHERE status IN ('CONFIRMED','COMPLETED')")->fetchColumn();
    $totalBookings = (int) $pdo->query("SELECT COUNT(*) FROM bookings")->fetchColumn();
    $confirmedBookings = (int) $pdo->query("SELECT COUNT(*) FROM bookings WHERE status = 'CONFIRMED'")->fetchColumn();
    $cancelledBookings = (int) $pdo->query("SELECT COUNT(*) FROM bookings WHERE status = 'CANCELLED'")->fetchColumn();
    $avgBookingValue = (float) $pdo->query("SELECT COALESCE(AVG(final_amount), 0) FROM bookings WHERE status IN ('CONFIRMED','COMPLETED')")->fetchColumn();

    // This month
    $thisMonthRevenue = (float) $pdo->query("SELECT COALESCE(SUM(final_amount), 0) FROM bookings WHERE status IN ('CONFIRMED','COMPLETED') AND MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())")->fetchColumn();
    $thisMonthBookings = (int) $pdo->query("SELECT COUNT(*) FROM bookings WHERE MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())")->fetchColumn();

    jsonResponse([
        'overview' => [
            'totalRevenue'       => $totalRevenue,
            'totalBookings'      => $totalBookings,
            'confirmedBookings'  => $confirmedBookings,
            'cancelledBookings'  => $cancelledBookings,
            'avgBookingValue'    => round($avgBookingValue, 2),
            'thisMonthRevenue'   => $thisMonthRevenue,
            'thisMonthBookings'  => $thisMonthBookings,
        ],
    ]);
}

/**
 * GET /admin/reports/revenue - Revenue by month.
 */
function getRevenueReport($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN', 'EMPLOYEE');

    $pdo = db();
    $months = (int) ($_GET['months'] ?? 12);

    $stmt = $pdo->prepare("
        SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,
               SUM(final_amount) AS revenue,
               COUNT(*) AS bookings_count
        FROM bookings
        WHERE status IN ('CONFIRMED','COMPLETED')
          AND created_at >= DATE_SUB(NOW(), INTERVAL ? MONTH)
        GROUP BY month
        ORDER BY month ASC
    ");
    $stmt->execute([$months]);

    jsonResponse(['revenue' => $stmt->fetchAll()]);
}

/**
 * GET /admin/reports/booking-trends - Booking count by month.
 */
function getBookingTrends($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN', 'EMPLOYEE');

    $pdo = db();
    $months = (int) ($_GET['months'] ?? 12);

    $stmt = $pdo->prepare("
        SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,
               COUNT(*) AS total,
               SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END) AS confirmed,
               SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled,
               SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pending
        FROM bookings
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? MONTH)
        GROUP BY month
        ORDER BY month ASC
    ");
    $stmt->execute([$months]);

    jsonResponse(['trends' => $stmt->fetchAll()]);
}

/**
 * GET /admin/reports/popular-trips - Most booked trips.
 */
function getPopularTripsReport($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN', 'EMPLOYEE');

    $pdo = db();
    $limit = (int) ($_GET['limit'] ?? 10);

    $stmt = $pdo->prepare("
        SELECT t.id, t.title, t.destination, t.price,
               COUNT(b.id) AS total_bookings,
               SUM(CASE WHEN b.status IN ('CONFIRMED','COMPLETED') THEN 1 ELSE 0 END) AS confirmed_bookings,
               COALESCE(SUM(CASE WHEN b.status IN ('CONFIRMED','COMPLETED') THEN b.final_amount ELSE 0 END), 0) AS total_revenue
        FROM trips t
        LEFT JOIN bookings b ON b.trip_id = t.id
        GROUP BY t.id, t.title, t.destination, t.price
        ORDER BY total_bookings DESC
        LIMIT ?
    ");
    $stmt->execute([$limit]);

    jsonResponse(['popularTrips' => $stmt->fetchAll()]);
}
