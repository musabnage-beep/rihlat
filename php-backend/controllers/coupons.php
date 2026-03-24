<?php

/**
 * POST /coupons/validate - Validate a coupon code.
 */
function validateCouponEndpoint($params): void {
    $body = getJsonBody();
    $code = $body['code'] ?? '';
    $orderAmount = (float) ($body['orderAmount'] ?? 0);

    if (empty($code)) {
        jsonError('Coupon code is required', 400);
    }

    $pdo = db();
    $stmt = $pdo->prepare("
        SELECT * FROM coupons
        WHERE code = ? AND is_active = 1
          AND (valid_from IS NULL OR valid_from <= NOW())
          AND (valid_until IS NULL OR valid_until >= NOW())
          AND (max_uses IS NULL OR current_uses < max_uses)
    ");
    $stmt->execute([$code]);
    $coupon = $stmt->fetch();

    if (!$coupon) {
        jsonError('Invalid or expired coupon code', 404);
    }

    if ($coupon['min_order_amount'] && $orderAmount < (float) $coupon['min_order_amount']) {
        jsonError('Order amount does not meet the minimum required for this coupon', 400);
    }

    $discountAmount = 0;
    if ($coupon['discount_type'] === 'PERCENTAGE') {
        $discountAmount = round($orderAmount * (float) $coupon['discount_value'] / 100, 2);
    } else {
        $discountAmount = min((float) $coupon['discount_value'], $orderAmount);
    }

    jsonResponse([
        'valid' => true,
        'coupon' => [
            'id'            => $coupon['id'],
            'code'          => $coupon['code'],
            'discountType'  => $coupon['discount_type'],
            'discountValue' => (float) $coupon['discount_value'],
            'discountAmount'=> $discountAmount,
            'finalAmount'   => max(0, $orderAmount - $discountAmount),
        ],
    ]);
}
