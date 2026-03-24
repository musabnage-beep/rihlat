<?php

/**
 * GET /notifications - Get authenticated user's notifications.
 */
function getUserNotifications($params): void {
    $user = authenticate();
    $pdo = db();

    [$offset, $limit, $page] = paginationParams();

    $stmt = $pdo->prepare("
        SELECT id, title, message, type, is_read, data, created_at
        FROM notifications
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    ");
    $stmt->execute([$user['id'], $limit, $offset]);
    $rows = $stmt->fetchAll();

    $notifications = array_map(function ($n) {
        return [
            'id'        => $n['id'],
            'title'     => $n['title'],
            'message'   => $n['message'],
            'type'      => $n['type'],
            'isRead'    => (bool) $n['is_read'],
            'data'      => $n['data'] ? json_decode($n['data'], true) : null,
            'createdAt' => $n['created_at'],
        ];
    }, $rows);

    $totalStmt = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE user_id = ?");
    $totalStmt->execute([$user['id']]);
    $total = (int) $totalStmt->fetchColumn();

    jsonResponse([
        'notifications' => $notifications,
        'pagination' => [
            'page'       => $page,
            'limit'      => $limit,
            'total'      => $total,
            'totalPages' => (int) ceil($total / $limit),
        ],
    ]);
}

/**
 * GET /notifications/unread-count - Count unread.
 */
function getUnreadCount($params): void {
    $user = authenticate();
    $pdo = db();

    $stmt = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0");
    $stmt->execute([$user['id']]);

    jsonResponse(['count' => (int) $stmt->fetchColumn()]);
}

/**
 * PUT /notifications/{id}/read - Mark as read.
 */
function markNotificationRead($params): void {
    $user = authenticate();
    $notifId = $params['id'] ?? '';
    $pdo = db();

    $stmt = $pdo->prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?");
    $stmt->execute([$notifId, $user['id']]);

    jsonResponse(['message' => 'Notification marked as read']);
}

/**
 * PUT /notifications/read-all - Mark all as read.
 */
function markAllNotificationsRead($params): void {
    $user = authenticate();
    $pdo = db();

    $pdo->prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0")->execute([$user['id']]);

    jsonResponse(['message' => 'All notifications marked as read']);
}

/**
 * GET /admin/notifications - Admin: list all notifications.
 */
function adminGetNotifications($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN', 'EMPLOYEE');

    $pdo = db();
    [$offset, $limit, $page] = paginationParams();

    $stmt = $pdo->prepare("
        SELECT n.id, n.title, n.message, n.type, n.is_read, n.created_at,
               CONCAT(u.first_name, ' ', u.last_name) AS user_name, u.email AS user_email
        FROM notifications n
        LEFT JOIN users u ON u.id = n.user_id
        ORDER BY n.created_at DESC
        LIMIT ? OFFSET ?
    ");
    $stmt->execute([$limit, $offset]);
    $rows = $stmt->fetchAll();

    $totalStmt = $pdo->query("SELECT COUNT(*) FROM notifications");
    $total = (int) $totalStmt->fetchColumn();

    jsonResponse([
        'notifications' => array_map(function ($n) {
            return [
                'id'        => $n['id'],
                'title'     => $n['title'],
                'message'   => $n['message'],
                'type'      => $n['type'],
                'isRead'    => (bool) $n['is_read'],
                'userName'  => $n['user_name'],
                'userEmail' => $n['user_email'],
                'createdAt' => $n['created_at'],
            ];
        }, $rows),
        'pagination' => [
            'page'       => $page,
            'limit'      => $limit,
            'total'      => $total,
            'totalPages' => (int) ceil($total / $limit),
        ],
    ]);
}

/**
 * POST /admin/notifications - Send notification.
 */
function adminSendNotification($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN', 'EMPLOYEE');

    $body = getJsonBody();
    $title = sanitizeString($body['title'] ?? '');
    $message = $body['message'] ?? '';
    $type = $body['type'] ?? 'GENERAL';
    $userIds = $body['userIds'] ?? [];
    $sendToAll = $body['sendToAll'] ?? false;

    if (empty($title) || empty($message)) {
        jsonError('Title and message are required', 400);
    }

    $pdo = db();

    if ($sendToAll) {
        $stmt = $pdo->query("SELECT id FROM users WHERE role = 'CUSTOMER' AND is_active = 1");
        $userIds = $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    if (empty($userIds)) {
        jsonError('No recipients specified', 400);
    }

    $insertStmt = $pdo->prepare("INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, NOW())");

    $count = 0;
    foreach ($userIds as $uid) {
        $insertStmt->execute([uuid(), $uid, $title, $message, $type]);
        $count++;
    }

    jsonResponse(['message' => "Notification sent to {$count} user(s)"], 201);
}
