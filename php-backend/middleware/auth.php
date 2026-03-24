<?php

require_once __DIR__ . '/../utils/jwt.php';
require_once __DIR__ . '/../utils/helpers.php';

/**
 * Authenticate the current request using Bearer token.
 * Returns the authenticated user array or sends 401 and exits.
 */
function authenticate(): array {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (empty($header)) {
        // Try Apache workaround
        if (function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            $header = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        }
    }

    if (empty($header) || !preg_match('/^Bearer\s+(.+)$/i', $header, $matches)) {
        jsonError('Authentication required', 401);
    }

    $token = $matches[1];
    $payload = JWT::verifyAccessToken($token);

    if (!$payload) {
        jsonError('Invalid or expired token', 401);
    }

    // Fetch user from DB
    $pdo = db();
    $stmt = $pdo->prepare('SELECT id, email, phone, first_name, last_name, role, is_active, avatar_url, created_at FROM users WHERE id = ? AND is_active = 1');
    $stmt->execute([$payload['sub']]);
    $user = $stmt->fetch();

    if (!$user) {
        jsonError('User not found or deactivated', 401);
    }

    return $user;
}

/**
 * Require the authenticated user to have a specific role.
 * Pass one or more roles. Sends 403 if role doesn't match.
 */
function requireRole(array $user, string ...$roles): void {
    if (!in_array($user['role'], $roles, true)) {
        jsonError('Insufficient permissions', 403);
    }
}

/**
 * Optionally authenticate - returns user array or null if no token provided.
 */
function optionalAuth(): ?array {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (empty($header)) {
        if (function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            $header = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        }
    }

    if (empty($header) || !preg_match('/^Bearer\s+(.+)$/i', $header, $matches)) {
        return null;
    }

    $token = $matches[1];
    $payload = JWT::verifyAccessToken($token);
    if (!$payload) {
        return null;
    }

    $pdo = db();
    $stmt = $pdo->prepare('SELECT id, email, phone, first_name, last_name, role, is_active, avatar_url, created_at FROM users WHERE id = ? AND is_active = 1');
    $stmt->execute([$payload['sub']]);
    return $stmt->fetch() ?: null;
}
