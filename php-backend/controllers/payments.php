<?php

require_once __DIR__ . '/../utils/helpers.php';
require_once __DIR__ . '/../middleware/auth.php';

/**
 * POST /payments/initiate - Create a Moyasar payment for a booking.
 */
function initiatePayment($params): void {
    $body = getJsonBody();
    $bookingId = $body['bookingId'] ?? '';

    if (empty($bookingId)) {
        jsonError('Booking ID is required', 400);
    }

    $pdo = db();
    $stmt = $pdo->prepare("SELECT * FROM bookings WHERE id = ? AND status = 'PENDING'");
    $stmt->execute([$bookingId]);
    $booking = $stmt->fetch();

    if (!$booking) {
        jsonError('Booking not found or not in pending status', 404);
    }

    if (empty(MOYASAR_SECRET_KEY)) {
        jsonError('Payment gateway not configured', 500);
    }

    // Create Moyasar payment via API
    $amountInHalala = (int) round((float) $booking['final_amount'] * 100);
    $callbackUrl = MOYASAR_CALLBACK_URL ?: (CLIENT_URL . '/api/payments/callback');

    $paymentData = [
        'amount'      => $amountInHalala,
        'currency'    => 'SAR',
        'description' => "Booking #{$booking['booking_number']}",
        'callback_url'=> $callbackUrl,
        'source'      => $body['source'] ?? ['type' => 'creditcard'],
        'metadata'    => [
            'booking_id'     => $bookingId,
            'booking_number' => $booking['booking_number'],
        ],
    ];

    $ch = curl_init('https://api.moyasar.com/v1/payments');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_USERPWD        => MOYASAR_SECRET_KEY . ':',
        CURLOPT_POSTFIELDS     => json_encode($paymentData),
        CURLOPT_TIMEOUT        => 30,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode < 200 || $httpCode >= 300) {
        jsonError('Failed to create payment', 500);
    }

    $moyasarPayment = json_decode($response, true);

    if (!$moyasarPayment || !isset($moyasarPayment['id'])) {
        jsonError('Invalid response from payment gateway', 500);
    }

    // Store payment record
    $paymentId = uuid();
    $stmt = $pdo->prepare("
        INSERT INTO payments (id, booking_id, amount, currency, status, moyasar_payment_id, payment_method, created_at, updated_at)
        VALUES (?, ?, ?, 'SAR', ?, ?, ?, NOW(), NOW())
    ");
    $stmt->execute([
        $paymentId,
        $bookingId,
        $booking['final_amount'],
        $moyasarPayment['status'] ?? 'initiated',
        $moyasarPayment['id'],
        $moyasarPayment['source']['type'] ?? 'creditcard',
    ]);

    jsonResponse([
        'paymentId'     => $paymentId,
        'moyasarId'     => $moyasarPayment['id'],
        'status'        => $moyasarPayment['status'] ?? 'initiated',
        'paymentUrl'    => $moyasarPayment['source']['transaction_url'] ?? null,
        'amount'        => (float) $booking['final_amount'],
    ]);
}

/**
 * GET/POST /payments/callback - Handle Moyasar callback.
 */
function paymentCallback($params): void {
    // Moyasar sends data via GET params or POST body
    $paymentId = $_GET['id'] ?? '';
    $status    = $_GET['status'] ?? '';

    if (empty($paymentId)) {
        $body = getJsonBody();
        $paymentId = $body['id'] ?? '';
        $status    = $body['status'] ?? '';
    }

    if (empty($paymentId)) {
        jsonError('Payment ID is required', 400);
    }

    // Verify payment with Moyasar API
    if (!empty(MOYASAR_SECRET_KEY)) {
        $ch = curl_init("https://api.moyasar.com/v1/payments/{$paymentId}");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_USERPWD        => MOYASAR_SECRET_KEY . ':',
            CURLOPT_TIMEOUT        => 30,
        ]);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 200) {
            $moyasarPayment = json_decode($response, true);
            $status = $moyasarPayment['status'] ?? $status;
        }
    }

    $pdo = db();

    // Find our payment record
    $stmt = $pdo->prepare('SELECT * FROM payments WHERE moyasar_payment_id = ?');
    $stmt->execute([$paymentId]);
    $payment = $stmt->fetch();

    if (!$payment) {
        jsonError('Payment record not found', 404);
    }

    // Update payment status
    $paymentStatus = $status;
    $paidAt = ($status === 'paid') ? 'NOW()' : 'NULL';

    $stmt = $pdo->prepare("UPDATE payments SET status = ?, paid_at = {$paidAt}, updated_at = NOW() WHERE id = ?");
    $stmt->execute([$paymentStatus, $payment['id']]);

    // Update booking status based on payment
    if ($status === 'paid') {
        $pdo->prepare("UPDATE bookings SET status = 'CONFIRMED', confirmed_at = NOW(), updated_at = NOW() WHERE id = ?")->execute([$payment['booking_id']]);

        // Get booking for notification
        $stmt = $pdo->prepare('SELECT user_id, booking_number FROM bookings WHERE id = ?');
        $stmt->execute([$payment['booking_id']]);
        $booking = $stmt->fetch();

        if ($booking && $booking['user_id']) {
            $notifId = uuid();
            $pdo->prepare("
                INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at)
                VALUES (?, ?, ?, ?, 'PAYMENT_SUCCESS', 0, NOW())
            ")->execute([$notifId, $booking['user_id'], 'تم الدفع بنجاح', "تم تأكيد دفع الحجز رقم {$booking['booking_number']}"]);
        }
    } elseif ($status === 'failed') {
        // Get booking for notification
        $stmt = $pdo->prepare('SELECT user_id, booking_number FROM bookings WHERE id = ?');
        $stmt->execute([$payment['booking_id']]);
        $booking = $stmt->fetch();

        if ($booking && $booking['user_id']) {
            $notifId = uuid();
            $pdo->prepare("
                INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at)
                VALUES (?, ?, ?, ?, 'PAYMENT_FAILED', 0, NOW())
            ")->execute([$notifId, $booking['user_id'], 'فشل الدفع', "فشلت عملية الدفع للحجز رقم {$booking['booking_number']}"]);
        }
    }

    // Redirect to client
    $redirectUrl = CLIENT_URL !== '*' ? CLIENT_URL : '';
    if (!empty($redirectUrl)) {
        header("Location: {$redirectUrl}/booking/confirmation?bookingId={$payment['booking_id']}&status={$status}");
        exit;
    }

    jsonResponse(['status' => $status, 'bookingId' => $payment['booking_id']]);
}

/**
 * GET /payments/{bookingId}/status - Get payment status for a booking.
 */
function getPaymentStatus($params): void {
    $bookingId = $params['bookingId'] ?? '';
    $pdo = db();

    $stmt = $pdo->prepare("
        SELECT id, booking_id, amount, currency, status, moyasar_payment_id, payment_method, paid_at, created_at
        FROM payments
        WHERE booking_id = ?
        ORDER BY created_at DESC
        LIMIT 1
    ");
    $stmt->execute([$bookingId]);
    $payment = $stmt->fetch();

    if (!$payment) {
        jsonError('No payment found for this booking', 404);
    }

    jsonResponse([
        'payment' => [
            'id'              => $payment['id'],
            'bookingId'       => $payment['booking_id'],
            'amount'          => (float) $payment['amount'],
            'currency'        => $payment['currency'],
            'status'          => $payment['status'],
            'moyasarPaymentId'=> $payment['moyasar_payment_id'],
            'paymentMethod'   => $payment['payment_method'],
            'paidAt'          => $payment['paid_at'],
            'createdAt'       => $payment['created_at'],
        ],
    ]);
}
