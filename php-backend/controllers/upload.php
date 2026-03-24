<?php

/**
 * POST /upload - Upload image file.
 */
function uploadImage($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN', 'EMPLOYEE');

    if (empty($_FILES['file'])) {
        jsonError('No file uploaded', 400);
    }

    $file = $_FILES['file'];

    if ($file['error'] !== UPLOAD_ERR_OK) {
        jsonError('Upload failed with error code: ' . $file['error'], 400);
    }

    if ($file['size'] > MAX_UPLOAD_SIZE) {
        jsonError('File size exceeds maximum allowed (' . (MAX_UPLOAD_SIZE / 1024 / 1024) . 'MB)', 400);
    }

    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'];

    if (!in_array($ext, $allowedExts)) {
        jsonError('Invalid file type. Allowed: ' . implode(', ', $allowedExts), 400);
    }

    // Determine subdirectory from optional 'folder' param
    $folder = sanitizeString($_POST['folder'] ?? 'general');
    $folder = preg_replace('/[^a-zA-Z0-9_-]/', '', $folder);

    $uploadDir = UPLOAD_DIR . $folder . '/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    $filename = uuid() . '.' . $ext;
    $filepath = $uploadDir . $filename;

    if (!move_uploaded_file($file['tmp_name'], $filepath)) {
        jsonError('Failed to save file', 500);
    }

    $url = UPLOAD_URL . $folder . '/' . $filename;

    jsonResponse([
        'url'      => $url,
        'filename' => $filename,
        'size'     => $file['size'],
        'type'     => $file['type'],
    ], 201);
}

/**
 * DELETE /upload - Delete uploaded file.
 */
function deleteImage($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN', 'EMPLOYEE');

    $body = getJsonBody();
    $url = $body['url'] ?? '';

    if (empty($url)) {
        jsonError('File URL is required', 400);
    }

    // Security: ensure the path is within uploads directory
    $relativePath = ltrim($url, '/');
    if (strpos($relativePath, 'uploads/') !== 0) {
        jsonError('Invalid file path', 400);
    }

    $filePath = __DIR__ . '/../' . $relativePath;

    if (!file_exists($filePath)) {
        jsonError('File not found', 404);
    }

    if (!unlink($filePath)) {
        jsonError('Failed to delete file', 500);
    }

    jsonResponse(['message' => 'File deleted successfully']);
}
