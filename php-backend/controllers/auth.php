<?php

function registerUser($params): void {
    $data = getJsonBody();
    $email = sanitizeString($data['email'] ?? '');
    $password = $data['password'] ?? '';
    $firstName = sanitizeString($data['firstName'] ?? '');
    $lastName = sanitizeString($data['lastName'] ?? '');
    $phone = sanitizeString($data['phone'] ?? null);

    if (!$email || !$password || !$firstName || !$lastName) {
        jsonError('All fields are required');
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonError('Invalid email address');
    }
    if (strlen($password) < 6) {
        jsonError('Password must be at least 6 characters');
    }

    $pdo = db();

    // Check existing email
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        jsonError('A user with this email already exists', 409);
    }

    // Check existing phone
    if ($phone) {
        $stmt = $pdo->prepare('SELECT id FROM users WHERE phone = ?');
        $stmt->execute([$phone]);
        if ($stmt->fetch()) {
            jsonError('A user with this phone number already exists', 409);
        }
    }

    $id = uuid();
    $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

    $stmt = $pdo->prepare('INSERT INTO users (id, email, password_hash, first_name, last_name, phone, role) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([$id, $email, $passwordHash, $firstName, $lastName, $phone, 'CUSTOMER']);

    $tokenPayload = ['id' => $id, 'email' => $email, 'role' => 'CUSTOMER'];
    $accessToken = generateAccessToken($tokenPayload);
    $refreshToken = generateRefreshToken($tokenPayload);

    // Save session
    $sessionId = uuid();
    $expiresAt = date('Y-m-d H:i:s', time() + JWT_REFRESH_EXPIRY);
    $stmt = $pdo->prepare('INSERT INTO sessions (id, user_id, refresh_token, expires_at) VALUES (?, ?, ?, ?)');
    $stmt->execute([$sessionId, $id, $refreshToken, $expiresAt]);

    jsonResponse([
        'user' => [
            'id' => $id,
            'email' => $email,
            'firstName' => $firstName,
            'lastName' => $lastName,
            'phone' => $phone,
            'role' => 'CUSTOMER',
        ],
        'accessToken' => $accessToken,
        'refreshToken' => $refreshToken,
    ], 201);
}

function loginUser($params): void {
    $data = getJsonBody();
    $email = $data['email'] ?? '';
    $password = $data['password'] ?? '';

    if (!$email || !$password) {
        jsonError('Email and password are required');
    }

    $pdo = db();
    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        jsonError('Invalid email or password', 401);
    }

    if (!$user['is_active']) {
        jsonError('Account is deactivated', 401);
    }

    // Update last login
    $stmt = $pdo->prepare('UPDATE users SET last_login_at = NOW() WHERE id = ?');
    $stmt->execute([$user['id']]);

    $tokenPayload = ['id' => $user['id'], 'email' => $user['email'], 'role' => $user['role']];
    $accessToken = generateAccessToken($tokenPayload);
    $refreshToken = generateRefreshToken($tokenPayload);

    $sessionId = uuid();
    $expiresAt = date('Y-m-d H:i:s', time() + JWT_REFRESH_EXPIRY);
    $stmt = $pdo->prepare('INSERT INTO sessions (id, user_id, refresh_token, expires_at) VALUES (?, ?, ?, ?)');
    $stmt->execute([$sessionId, $user['id'], $refreshToken, $expiresAt]);

    unset($user['password_hash']);
    $user = formatUserRow($user);

    jsonResponse([
        'user' => $user,
        'accessToken' => $accessToken,
        'refreshToken' => $refreshToken,
    ]);
}

function refreshTokenHandler($params): void {
    $data = getJsonBody();
    $token = $data['refreshToken'] ?? '';

    if (!$token) {
        jsonError('Refresh token is required');
    }

    $payload = verifyRefreshToken($token);
    if (!$payload) {
        jsonError('Invalid or expired refresh token', 401);
    }

    $pdo = db();
    $stmt = $pdo->prepare('SELECT * FROM sessions WHERE refresh_token = ?');
    $stmt->execute([$token]);
    $session = $stmt->fetch();

    if (!$session || strtotime($session['expires_at']) < time()) {
        if ($session) {
            $stmt = $pdo->prepare('DELETE FROM sessions WHERE id = ?');
            $stmt->execute([$session['id']]);
        }
        jsonError('Session expired or not found', 401);
    }

    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$session['user_id']]);
    $user = $stmt->fetch();

    if (!$user || !$user['is_active']) {
        jsonError('User not found or deactivated', 401);
    }

    $newPayload = ['id' => $user['id'], 'email' => $user['email'], 'role' => $user['role']];
    $newAccessToken = generateAccessToken($newPayload);
    $newRefreshToken = generateRefreshToken($newPayload);

    $expiresAt = date('Y-m-d H:i:s', time() + JWT_REFRESH_EXPIRY);
    $stmt = $pdo->prepare('UPDATE sessions SET refresh_token = ?, expires_at = ? WHERE id = ?');
    $stmt->execute([$newRefreshToken, $expiresAt, $session['id']]);

    jsonResponse([
        'accessToken' => $newAccessToken,
        'refreshToken' => $newRefreshToken,
    ]);
}

function logoutUser($params): void {
    $data = getJsonBody();
    $token = $data['refreshToken'] ?? '';

    if ($token) {
        $pdo = db();
        $stmt = $pdo->prepare('DELETE FROM sessions WHERE refresh_token = ?');
        $stmt->execute([$token]);
    }

    jsonResponse(['message' => 'Logged out successfully']);
}

function getMe($params): void {
    $user = authenticate();
    $pdo = db();
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$user['id']]);
    $row = $stmt->fetch();

    if (!$row) {
        jsonError('User not found', 404);
    }

    unset($row['password_hash']);
    jsonResponse(['user' => formatUserRow($row)]);
}

function updateMe($params): void {
    $user = authenticate();
    $data = getJsonBody();
    $pdo = db();

    $firstName = sanitizeString($data['firstName'] ?? null);
    $lastName = sanitizeString($data['lastName'] ?? null);
    $phone = sanitizeString($data['phone'] ?? null);

    if ($phone) {
        $stmt = $pdo->prepare('SELECT id FROM users WHERE phone = ? AND id != ?');
        $stmt->execute([$phone, $user['id']]);
        if ($stmt->fetch()) {
            jsonError('A user with this phone number already exists', 409);
        }
    }

    $sets = [];
    $params_sql = [];
    if ($firstName !== null && $firstName !== '') { $sets[] = 'first_name = ?'; $params_sql[] = $firstName; }
    if ($lastName !== null && $lastName !== '') { $sets[] = 'last_name = ?'; $params_sql[] = $lastName; }
    if ($phone !== null && $phone !== '') { $sets[] = 'phone = ?'; $params_sql[] = $phone; }

    if (empty($sets)) {
        jsonError('No fields to update');
    }

    $params_sql[] = $user['id'];
    $stmt = $pdo->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?');
    $stmt->execute($params_sql);

    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$user['id']]);
    $row = $stmt->fetch();
    unset($row['password_hash']);
    jsonResponse(formatUserRow($row));
}

function changePassword($params): void {
    $user = authenticate();
    $data = getJsonBody();
    $oldPassword = $data['oldPassword'] ?? '';
    $newPassword = $data['newPassword'] ?? '';

    if (!$oldPassword || !$newPassword) {
        jsonError('Old and new passwords are required');
    }
    if (strlen($newPassword) < 6) {
        jsonError('New password must be at least 6 characters');
    }

    $pdo = db();
    $stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = ?');
    $stmt->execute([$user['id']]);
    $row = $stmt->fetch();

    if (!password_verify($oldPassword, $row['password_hash'])) {
        jsonError('Current password is incorrect');
    }

    $newHash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 12]);
    $stmt = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
    $stmt->execute([$newHash, $user['id']]);

    jsonResponse(['message' => 'Password changed successfully']);
}

function formatUserRow(array $row): array {
    return [
        'id' => $row['id'],
        'email' => $row['email'],
        'phone' => $row['phone'] ?? null,
        'firstName' => $row['first_name'],
        'lastName' => $row['last_name'],
        'role' => $row['role'],
        'isActive' => (bool)($row['is_active'] ?? true),
        'avatarUrl' => $row['avatar_url'] ?? null,
        'lastLoginAt' => $row['last_login_at'] ?? null,
        'createdAt' => $row['created_at'] ?? null,
        'updatedAt' => $row['updated_at'] ?? null,
    ];
}
