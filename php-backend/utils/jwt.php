<?php

class JWT {

    /**
     * Encode a payload into a JWT token.
     */
    public static function encode(array $payload, string $secret): string {
        $header = self::base64UrlEncode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $body = self::base64UrlEncode(json_encode($payload));
        $signature = self::base64UrlEncode(
            hash_hmac('sha256', "{$header}.{$body}", $secret, true)
        );
        return "{$header}.{$body}.{$signature}";
    }

    /**
     * Decode and verify a JWT token. Returns payload array or null on failure.
     */
    public static function decode(string $token, string $secret): ?array {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }

        [$header, $body, $signature] = $parts;

        // Verify signature
        $expectedSig = self::base64UrlEncode(
            hash_hmac('sha256', "{$header}.{$body}", $secret, true)
        );

        if (!hash_equals($expectedSig, $signature)) {
            return null;
        }

        $payload = json_decode(self::base64UrlDecode($body), true);
        if (!$payload) {
            return null;
        }

        // Check expiration
        if (isset($payload['exp']) && $payload['exp'] < time()) {
            return null;
        }

        return $payload;
    }

    /**
     * Generate an access token for a user.
     */
    public static function generateAccessToken(array $user): string {
        $payload = [
            'sub'   => $user['id'],
            'email' => $user['email'],
            'role'  => $user['role'],
            'iat'   => time(),
            'exp'   => time() + JWT_ACCESS_EXPIRY,
        ];
        return self::encode($payload, JWT_ACCESS_SECRET);
    }

    /**
     * Generate a refresh token for a user.
     */
    public static function generateRefreshToken(array $user): string {
        $payload = [
            'sub'  => $user['id'],
            'type' => 'refresh',
            'iat'  => time(),
            'exp'  => time() + JWT_REFRESH_EXPIRY,
        ];
        return self::encode($payload, JWT_REFRESH_SECRET);
    }

    /**
     * Verify an access token and return payload or null.
     */
    public static function verifyAccessToken(string $token): ?array {
        return self::decode($token, JWT_ACCESS_SECRET);
    }

    /**
     * Verify a refresh token and return payload or null.
     */
    public static function verifyRefreshToken(string $token): ?array {
        $payload = self::decode($token, JWT_REFRESH_SECRET);
        if ($payload && ($payload['type'] ?? '') === 'refresh') {
            return $payload;
        }
        return null;
    }

    private static function base64UrlEncode(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $data): string {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}
