<?php

// Load .env file if exists
function loadEnv($path) {
    if (!file_exists($path)) return;
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        if (strpos($line, '=') === false) continue;
        list($key, $value) = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value, " \t\n\r\0\x0B\"'");
        if (!getenv($key)) {
            putenv("$key=$value");
        }
    }
}

loadEnv(__DIR__ . '/../.env');

// Config constants
define('JWT_ACCESS_SECRET', getenv('JWT_ACCESS_SECRET') ?: 'your-access-secret-change-me');
define('JWT_REFRESH_SECRET', getenv('JWT_REFRESH_SECRET') ?: 'your-refresh-secret-change-me');
define('JWT_ACCESS_EXPIRY', 3600); // 1 hour in seconds
define('JWT_REFRESH_EXPIRY', 604800); // 7 days in seconds
define('MOYASAR_SECRET_KEY', getenv('MOYASAR_SECRET_KEY') ?: '');
define('MOYASAR_PUBLISHABLE_KEY', getenv('MOYASAR_PUBLISHABLE_KEY') ?: '');
define('MOYASAR_CALLBACK_URL', getenv('MOYASAR_CALLBACK_URL') ?: '');
define('CLIENT_URL', getenv('CLIENT_URL') ?: '*');
define('UPLOAD_DIR', __DIR__ . '/../uploads/');
define('UPLOAD_URL', '/uploads/');
define('MAX_UPLOAD_SIZE', 5 * 1024 * 1024); // 5MB
