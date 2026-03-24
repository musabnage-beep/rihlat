<?php

require_once __DIR__ . '/../config/database.php';

/**
 * Generate a UUID v4 string.
 */
function uuid(): string {
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40); // version 4
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80); // variant RFC 4122
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

/**
 * Decode JSON request body and return associative array.
 */
function getJsonBody(): array {
    $raw = file_get_contents('php://input');
    if (empty($raw)) {
        return [];
    }
    $decoded = json_decode($raw, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        jsonError('Invalid JSON body', 400);
    }
    return $decoded ?? [];
}

/**
 * Send a JSON response and exit.
 */
function jsonResponse(array $data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Send a JSON error response and exit.
 */
function jsonError(string $message, int $code = 400): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => true, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Sanitize a string value: trim and escape HTML entities. Returns empty string for null.
 */
function sanitizeString($value): string {
    if ($value === null || $value === false) {
        return '';
    }
    return htmlspecialchars(trim((string) $value), ENT_QUOTES, 'UTF-8');
}

/**
 * Shortcut to get the PDO database connection.
 */
function db(): PDO {
    return Database::getInstance()->getConnection();
}

/**
 * Extract pagination parameters from $_GET.
 * Returns [offset, limit, page].
 */
function paginationParams(): array {
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $limit = max(1, min(100, (int) ($_GET['limit'] ?? 12)));
    $offset = ($page - 1) * $limit;
    return [$offset, $limit, $page];
}

/**
 * Generate a URL-friendly slug from a string.
 */
function generateSlug(string $title): string {
    // Transliterate Arabic characters to a simple form
    $slug = mb_strtolower($title, 'UTF-8');
    // Replace spaces and non-alphanumeric chars with hyphens
    $slug = preg_replace('/[^\p{L}\p{N}]+/u', '-', $slug);
    $slug = trim($slug, '-');
    // Add a short random suffix to ensure uniqueness
    $slug .= '-' . substr(md5(uniqid()), 0, 6);
    return $slug;
}

/**
 * Generate a booking number like BK-20260324-A1B2C3.
 */
function generateBookingNumber(): string {
    $date = date('Ymd');
    $rand = strtoupper(substr(md5(uniqid(mt_rand(), true)), 0, 6));
    return "BK-{$date}-{$rand}";
}
