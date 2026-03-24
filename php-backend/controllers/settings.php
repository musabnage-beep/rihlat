<?php

/**
 * GET /settings - Public: get company settings.
 */
function getCompanySettings($params): void {
    $pdo = db();
    $stmt = $pdo->query("SELECT * FROM company_settings ORDER BY id LIMIT 1");
    $settings = $stmt->fetch();

    if (!$settings) {
        jsonResponse(['settings' => null]);
        return;
    }

    $socialMedia = $settings['social_media'] ? json_decode($settings['social_media'], true) : [];

    jsonResponse([
        'settings' => [
            'companyName'    => $settings['company_name'],
            'companyEmail'   => $settings['company_email'],
            'companyPhone'   => $settings['company_phone'],
            'companyAddress' => $settings['company_address'],
            'logoUrl'        => $settings['logo_url'],
            'primaryColor'   => $settings['primary_color'],
            'whatsappNumber' => $settings['whatsapp_number'],
            'socialMedia'    => $socialMedia,
        ],
    ]);
}

/**
 * GET /admin/settings - Admin: get settings.
 */
function adminGetSettings($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN', 'EMPLOYEE');
    getCompanySettings($params);
}

/**
 * PUT /admin/settings - Update company settings.
 */
function updateCompanySettings($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN');

    $body = getJsonBody();
    $pdo = db();

    // Check if settings exist
    $existing = $pdo->query("SELECT id FROM company_settings LIMIT 1")->fetch();

    $socialMedia = isset($body['socialMedia']) ? json_encode($body['socialMedia'], JSON_UNESCAPED_UNICODE) : null;

    if ($existing) {
        $fields = [];
        $bindings = [];

        if (array_key_exists('companyName', $body)) { $fields[] = 'company_name = ?'; $bindings[] = sanitizeString($body['companyName']); }
        if (array_key_exists('companyEmail', $body)) { $fields[] = 'company_email = ?'; $bindings[] = sanitizeString($body['companyEmail']); }
        if (array_key_exists('companyPhone', $body)) { $fields[] = 'company_phone = ?'; $bindings[] = sanitizeString($body['companyPhone']); }
        if (array_key_exists('companyAddress', $body)) { $fields[] = 'company_address = ?'; $bindings[] = $body['companyAddress']; }
        if (array_key_exists('logoUrl', $body)) { $fields[] = 'logo_url = ?'; $bindings[] = $body['logoUrl']; }
        if (array_key_exists('primaryColor', $body)) { $fields[] = 'primary_color = ?'; $bindings[] = sanitizeString($body['primaryColor']); }
        if (array_key_exists('whatsappNumber', $body)) { $fields[] = 'whatsapp_number = ?'; $bindings[] = sanitizeString($body['whatsappNumber']); }
        if ($socialMedia !== null) { $fields[] = 'social_media = ?'; $bindings[] = $socialMedia; }

        if (!empty($fields)) {
            $fields[] = 'updated_at = NOW()';
            $bindings[] = $existing['id'];
            $sql = "UPDATE company_settings SET " . implode(', ', $fields) . " WHERE id = ?";
            $pdo->prepare($sql)->execute($bindings);
        }
    } else {
        $id = uuid();
        $stmt = $pdo->prepare("
            INSERT INTO company_settings (id, company_name, company_email, company_phone, company_address, logo_url, primary_color, whatsapp_number, social_media, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ");
        $stmt->execute([
            $id,
            sanitizeString($body['companyName'] ?? ''),
            sanitizeString($body['companyEmail'] ?? ''),
            sanitizeString($body['companyPhone'] ?? ''),
            $body['companyAddress'] ?? '',
            $body['logoUrl'] ?? null,
            sanitizeString($body['primaryColor'] ?? '#2563eb'),
            sanitizeString($body['whatsappNumber'] ?? ''),
            $socialMedia,
        ]);
    }

    jsonResponse(['message' => 'Settings updated']);
}

/**
 * GET /admin/employees - List employees.
 */
function getEmployees($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN');

    $pdo = db();
    $stmt = $pdo->query("SELECT id, email, phone, first_name, last_name, is_active, last_login_at, created_at FROM users WHERE role = 'EMPLOYEE' ORDER BY created_at DESC");
    $employees = array_map(function ($e) {
        return [
            'id'          => $e['id'],
            'email'       => $e['email'],
            'phone'       => $e['phone'],
            'firstName'   => $e['first_name'],
            'lastName'    => $e['last_name'],
            'isActive'    => (bool) $e['is_active'],
            'lastLoginAt' => $e['last_login_at'],
            'createdAt'   => $e['created_at'],
        ];
    }, $stmt->fetchAll());

    jsonResponse(['employees' => $employees]);
}

/**
 * POST /admin/employees - Create employee.
 */
function createEmployee($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN');

    $body = getJsonBody();
    $pdo = db();

    $email = sanitizeString($body['email'] ?? '');
    $password = $body['password'] ?? '';
    $firstName = sanitizeString($body['firstName'] ?? '');
    $lastName = sanitizeString($body['lastName'] ?? '');
    $phone = sanitizeString($body['phone'] ?? '');

    if (!$email || !$password || !$firstName || !$lastName) {
        jsonError('All fields are required', 400);
    }

    // Check email uniqueness
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        jsonError('Email already in use', 409);
    }

    $id = uuid();
    $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

    $stmt = $pdo->prepare("INSERT INTO users (id, email, password_hash, first_name, last_name, phone, role, is_active, assigned_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'EMPLOYEE', 1, ?, NOW(), NOW())");
    $stmt->execute([$id, $email, $hash, $firstName, $lastName, $phone ?: null, $user['id']]);

    jsonResponse(['id' => $id, 'message' => 'Employee created'], 201);
}

/**
 * PUT /admin/employees/{id} - Update employee.
 */
function updateEmployee($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN');

    $employeeId = $params['id'] ?? '';
    $body = getJsonBody();
    $pdo = db();

    $fields = [];
    $bindings = [];

    if (array_key_exists('firstName', $body)) { $fields[] = 'first_name = ?'; $bindings[] = sanitizeString($body['firstName']); }
    if (array_key_exists('lastName', $body)) { $fields[] = 'last_name = ?'; $bindings[] = sanitizeString($body['lastName']); }
    if (array_key_exists('phone', $body)) { $fields[] = 'phone = ?'; $bindings[] = sanitizeString($body['phone']); }
    if (array_key_exists('isActive', $body)) { $fields[] = 'is_active = ?'; $bindings[] = (int) $body['isActive']; }
    if (!empty($body['password'])) {
        $fields[] = 'password_hash = ?';
        $bindings[] = password_hash($body['password'], PASSWORD_BCRYPT, ['cost' => 12]);
    }

    if (empty($fields)) {
        jsonError('No fields to update', 400);
    }

    $fields[] = 'updated_at = NOW()';
    $bindings[] = $employeeId;

    $sql = "UPDATE users SET " . implode(', ', $fields) . " WHERE id = ? AND role = 'EMPLOYEE'";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($bindings);

    if ($stmt->rowCount() === 0) {
        jsonError('Employee not found', 404);
    }

    jsonResponse(['message' => 'Employee updated']);
}

/**
 * DELETE /admin/employees/{id} - Delete/deactivate employee.
 */
function deleteEmployee($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN');

    $employeeId = $params['id'] ?? '';
    $pdo = db();

    // Soft delete: deactivate instead of deleting
    $stmt = $pdo->prepare("UPDATE users SET is_active = 0, updated_at = NOW() WHERE id = ? AND role = 'EMPLOYEE'");
    $stmt->execute([$employeeId]);

    if ($stmt->rowCount() === 0) {
        jsonError('Employee not found', 404);
    }

    jsonResponse(['message' => 'Employee deactivated']);
}
