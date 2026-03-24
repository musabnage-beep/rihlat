<?php

require_once __DIR__ . '/../utils/helpers.php';
require_once __DIR__ . '/../middleware/auth.php';

/**
 * GET /trips - List published trips with pagination, search, filters, sorting.
 */
function getTrips($params): void {
    $pdo = db();
    [$offset, $limit, $page] = paginationParams();

    $search      = $_GET['search'] ?? '';
    $destination = $_GET['destination'] ?? '';
    $category    = $_GET['category'] ?? '';
    $sortBy      = $_GET['sortBy'] ?? 'date_asc';

    $where = ["t.status = 'PUBLISHED'"];
    $bindings = [];

    if (!empty($search)) {
        $where[] = "(t.title LIKE ? OR t.description LIKE ? OR t.destination LIKE ?)";
        $bindings[] = "%{$search}%";
        $bindings[] = "%{$search}%";
        $bindings[] = "%{$search}%";
    }

    if (!empty($destination)) {
        $where[] = "t.destination LIKE ?";
        $bindings[] = "%{$destination}%";
    }

    if (!empty($category)) {
        $where[] = "t.category = ?";
        $bindings[] = $category;
    }

    $whereClause = implode(' AND ', $where);

    // Sorting
    $orderBy = match ($sortBy) {
        'price_asc'  => 't.price ASC',
        'price_desc' => 't.price DESC',
        'date_desc'  => 't.departure_date DESC',
        'popular'    => 'bookings_count DESC, t.departure_date ASC',
        default      => 't.departure_date ASC',
    };

    // Count total
    $countSql = "SELECT COUNT(*) FROM trips t WHERE {$whereClause}";
    $stmt = $pdo->prepare($countSql);
    $stmt->execute($bindings);
    $total = (int) $stmt->fetchColumn();

    // Fetch trips with primary image and booking count
    $sql = "
        SELECT t.id, t.title, t.slug, t.short_description, t.destination, t.departure_city,
               t.departure_date, t.return_date, t.duration_days, t.price, t.child_price,
               t.max_persons, t.status, t.is_featured, t.category,
               (SELECT ti.image_url FROM trip_images ti WHERE ti.trip_id = t.id ORDER BY ti.sort_order ASC LIMIT 1) AS primary_image,
               (SELECT COUNT(*) FROM bookings b WHERE b.trip_id = t.id AND b.status IN ('CONFIRMED','COMPLETED')) AS bookings_count
        FROM trips t
        WHERE {$whereClause}
        ORDER BY {$orderBy}
        LIMIT ? OFFSET ?
    ";
    $stmt = $pdo->prepare($sql);
    $allBindings = array_merge($bindings, [$limit, $offset]);
    $stmt->execute($allBindings);
    $rows = $stmt->fetchAll();

    $trips = array_map(function ($r) {
        $bookedSeats = (int) $r['bookings_count'];
        return [
            'id'               => $r['id'],
            'title'            => $r['title'],
            'slug'             => $r['slug'],
            'shortDescription' => $r['short_description'],
            'destination'      => $r['destination'],
            'departureCity'    => $r['departure_city'],
            'departureDate'    => $r['departure_date'],
            'returnDate'       => $r['return_date'],
            'duration'         => (int) $r['duration_days'],
            'pricePerPerson'   => (float) $r['price'],
            'childPrice'       => $r['child_price'] ? (float) $r['child_price'] : null,
            'totalSeats'       => (int) $r['max_persons'],
            'availableSeats'   => max(0, (int) $r['max_persons'] - $bookedSeats),
            'isFeatured'       => (bool) $r['is_featured'],
            'status'           => $r['status'],
            'primaryImage'     => $r['primary_image'],
            'category'         => $r['category'],
        ];
    }, $rows);

    jsonResponse([
        'trips'      => $trips,
        'total'      => $total,
        'pagination' => [
            'page'       => $page,
            'limit'      => $limit,
            'total'      => $total,
            'totalPages' => ceil($total / $limit),
        ],
    ]);
}

/**
 * GET /trips/featured - Get featured published trips.
 */
function getFeaturedTrips($params): void {
    $pdo = db();
    $stmt = $pdo->prepare("
        SELECT t.id, t.title, t.slug, t.short_description, t.destination,
               t.departure_date, t.return_date, t.duration_days, t.price, t.max_persons,
               t.is_featured, t.status,
               (SELECT ti.image_url FROM trip_images ti WHERE ti.trip_id = t.id ORDER BY ti.sort_order ASC LIMIT 1) AS primary_image,
               (SELECT COUNT(*) FROM bookings b WHERE b.trip_id = t.id AND b.status IN ('CONFIRMED','COMPLETED')) AS bookings_count
        FROM trips t
        WHERE t.is_featured = 1 AND t.status = 'PUBLISHED'
        ORDER BY t.departure_date ASC
        LIMIT 6
    ");
    $stmt->execute();
    $rows = $stmt->fetchAll();

    $trips = array_map(function ($r) {
        return [
            'id'               => $r['id'],
            'title'            => $r['title'],
            'slug'             => $r['slug'],
            'shortDescription' => $r['short_description'],
            'destination'      => $r['destination'],
            'departureDate'    => $r['departure_date'],
            'returnDate'       => $r['return_date'],
            'duration'         => (int) $r['duration_days'],
            'pricePerPerson'   => (float) $r['price'],
            'totalSeats'       => (int) $r['max_persons'],
            'availableSeats'   => max(0, (int) $r['max_persons'] - (int) $r['bookings_count']),
            'isFeatured'       => true,
            'status'           => $r['status'],
            'primaryImage'     => $r['primary_image'],
        ];
    }, $rows);

    jsonResponse(['trips' => $trips]);
}

/**
 * GET /trips/categories - Get distinct categories.
 */
function getCategories($params): void {
    $pdo = db();
    $stmt = $pdo->query("SELECT DISTINCT category FROM trips WHERE status = 'PUBLISHED' AND category IS NOT NULL AND category != '' ORDER BY category");
    $categories = $stmt->fetchAll(PDO::FETCH_COLUMN);

    jsonResponse(['categories' => $categories]);
}

/**
 * GET /trips/{slug} - Get single trip by slug (or by ID).
 */
function getTripBySlug($params): void {
    $slugOrId = $params['slug'] ?? '';
    $pdo = db();

    // Try slug first, then ID
    $stmt = $pdo->prepare("
        SELECT t.*,
            (SELECT COUNT(*) FROM bookings b WHERE b.trip_id = t.id AND b.status IN ('CONFIRMED','COMPLETED')) AS bookings_count
        FROM trips t
        WHERE (t.slug = ? OR t.id = ?)
        LIMIT 1
    ");
    $stmt->execute([$slugOrId, $slugOrId]);
    $trip = $stmt->fetch();

    if (!$trip) {
        jsonError('Trip not found', 404);
    }

    // Get images
    $stmt = $pdo->prepare('SELECT id, image_url, alt_text, sort_order FROM trip_images WHERE trip_id = ? ORDER BY sort_order ASC');
    $stmt->execute([$trip['id']]);
    $images = $stmt->fetchAll();

    $bookedSeats = (int) $trip['bookings_count'];
    $includes = $trip['includes'] ? json_decode($trip['includes'], true) : [];
    $excludes = $trip['excludes'] ? json_decode($trip['excludes'], true) : [];
    $itinerary = $trip['itinerary'] ? json_decode($trip['itinerary'], true) : [];
    $pricingTiers = $trip['pricing_tiers'] ? json_decode($trip['pricing_tiers'], true) : [];

    $imageList = array_map(function ($img, $i) {
        return [
            'id'        => $img['id'],
            'url'       => $img['image_url'],
            'altText'   => $img['alt_text'],
            'sortOrder' => (int) $img['sort_order'],
            'isPrimary' => $i === 0,
        ];
    }, $images, array_keys($images));

    jsonResponse([
        'trip' => [
            'id'               => $trip['id'],
            'title'            => $trip['title'],
            'slug'             => $trip['slug'],
            'description'      => $trip['description'],
            'shortDescription' => $trip['short_description'],
            'destination'      => $trip['destination'],
            'departureCity'    => $trip['departure_city'],
            'departureDate'    => $trip['departure_date'],
            'returnDate'       => $trip['return_date'],
            'duration'         => (int) $trip['duration_days'],
            'pricePerPerson'   => (float) $trip['price'],
            'childPrice'       => $trip['child_price'] ? (float) $trip['child_price'] : null,
            'totalSeats'       => (int) $trip['max_persons'],
            'availableSeats'   => max(0, (int) $trip['max_persons'] - $bookedSeats),
            'isFeatured'       => (bool) $trip['is_featured'],
            'status'           => $trip['status'],
            'category'         => $trip['category'],
            'inclusions'       => $includes,
            'exclusions'       => $excludes,
            'itinerary'        => $itinerary,
            'pricingTiers'     => $pricingTiers,
            'meetingPoint'     => $trip['meeting_point'],
            'meetingTime'      => $trip['meeting_time'],
            'terms'            => $trip['terms'],
            'images'           => $imageList,
            'primaryImage'     => !empty($imageList) ? $imageList[0]['url'] : null,
            'createdAt'        => $trip['created_at'],
            'updatedAt'        => $trip['updated_at'],
        ],
    ]);
}

/**
 * POST /admin/trips - Create trip (admin only).
 */
function createTrip($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN', 'EMPLOYEE');

    $body = getJsonBody();
    $pdo = db();

    $id   = uuid();
    $slug = generateSlug($body['title'] ?? 'trip');

    $departureDate = $body['departureDate'] ?? null;
    $returnDate    = $body['returnDate'] ?? null;
    $durationDays  = 0;
    if ($departureDate && $returnDate) {
        $durationDays = max(1, (int) ceil((strtotime($returnDate) - strtotime($departureDate)) / 86400));
    }

    $includes     = isset($body['inclusions']) ? json_encode($body['inclusions'], JSON_UNESCAPED_UNICODE) : null;
    $excludes     = isset($body['exclusions']) ? json_encode($body['exclusions'], JSON_UNESCAPED_UNICODE) : null;
    $itinerary    = isset($body['itinerary']) ? json_encode($body['itinerary'], JSON_UNESCAPED_UNICODE) : null;
    $pricingTiers = isset($body['pricingTiers']) ? json_encode($body['pricingTiers'], JSON_UNESCAPED_UNICODE) : null;

    $stmt = $pdo->prepare("
        INSERT INTO trips (id, title, slug, description, short_description, category, destination, departure_city,
                           departure_date, return_date, duration_days, price, child_price, max_persons,
                           status, is_featured, includes, excludes, itinerary, pricing_tiers,
                           meeting_point, meeting_time, terms, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    ");

    $stmt->execute([
        $id,
        sanitizeString($body['title'] ?? ''),
        $slug,
        $body['description'] ?? '',
        sanitizeString($body['shortDescription'] ?? ''),
        sanitizeString($body['category'] ?? ''),
        sanitizeString($body['destination'] ?? ''),
        sanitizeString($body['departureCity'] ?? ''),
        $departureDate,
        $returnDate,
        $durationDays,
        (float) ($body['pricePerPerson'] ?? 0),
        isset($body['childPrice']) && $body['childPrice'] !== null ? (float) $body['childPrice'] : null,
        (int) ($body['totalSeats'] ?? 0),
        $body['status'] ?? 'DRAFT',
        (int) ($body['isFeatured'] ?? 0),
        $includes,
        $excludes,
        $itinerary,
        $pricingTiers,
        sanitizeString($body['meetingPoint'] ?? ''),
        sanitizeString($body['meetingTime'] ?? ''),
        $body['terms'] ?? '',
    ]);

    jsonResponse(['id' => $id, 'trip' => ['id' => $id, 'slug' => $slug]], 201);
}

/**
 * PUT /admin/trips/{id} - Update trip (admin only).
 */
function updateTrip($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN', 'EMPLOYEE');

    $tripId = $params['id'] ?? '';
    $body = getJsonBody();
    $pdo = db();

    // Check trip exists
    $stmt = $pdo->prepare('SELECT id FROM trips WHERE id = ?');
    $stmt->execute([$tripId]);
    if (!$stmt->fetch()) {
        jsonError('Trip not found', 404);
    }

    $fields = [];
    $bindings = [];

    $mapping = [
        'title'            => 'title',
        'description'      => 'description',
        'shortDescription' => 'short_description',
        'category'         => 'category',
        'destination'      => 'destination',
        'departureCity'    => 'departure_city',
        'departureDate'    => 'departure_date',
        'returnDate'       => 'return_date',
        'status'           => 'status',
        'meetingPoint'     => 'meeting_point',
        'meetingTime'      => 'meeting_time',
        'terms'            => 'terms',
    ];

    foreach ($mapping as $bodyKey => $dbCol) {
        if (array_key_exists($bodyKey, $body)) {
            $fields[] = "{$dbCol} = ?";
            $bindings[] = $body[$bodyKey];
        }
    }

    if (array_key_exists('pricePerPerson', $body)) {
        $fields[] = "price = ?";
        $bindings[] = (float) $body['pricePerPerson'];
    }
    if (array_key_exists('childPrice', $body)) {
        $fields[] = "child_price = ?";
        $bindings[] = $body['childPrice'] !== null ? (float) $body['childPrice'] : null;
    }
    if (array_key_exists('totalSeats', $body)) {
        $fields[] = "max_persons = ?";
        $bindings[] = (int) $body['totalSeats'];
    }
    if (array_key_exists('isFeatured', $body)) {
        $fields[] = "is_featured = ?";
        $bindings[] = (int) $body['isFeatured'];
    }
    if (array_key_exists('inclusions', $body)) {
        $fields[] = "includes = ?";
        $bindings[] = json_encode($body['inclusions'], JSON_UNESCAPED_UNICODE);
    }
    if (array_key_exists('exclusions', $body)) {
        $fields[] = "excludes = ?";
        $bindings[] = json_encode($body['exclusions'], JSON_UNESCAPED_UNICODE);
    }
    if (array_key_exists('itinerary', $body)) {
        $fields[] = "itinerary = ?";
        $bindings[] = json_encode($body['itinerary'], JSON_UNESCAPED_UNICODE);
    }
    if (array_key_exists('pricingTiers', $body)) {
        $fields[] = "pricing_tiers = ?";
        $bindings[] = json_encode($body['pricingTiers'], JSON_UNESCAPED_UNICODE);
    }

    // Recalculate duration if dates provided
    if (isset($body['departureDate'], $body['returnDate'])) {
        $dur = max(1, (int) ceil((strtotime($body['returnDate']) - strtotime($body['departureDate'])) / 86400));
        $fields[] = "duration_days = ?";
        $bindings[] = $dur;
    }

    if (empty($fields)) {
        jsonError('No fields to update', 400);
    }

    $fields[] = "updated_at = NOW()";
    $bindings[] = $tripId;

    $sql = "UPDATE trips SET " . implode(', ', $fields) . " WHERE id = ?";
    $pdo->prepare($sql)->execute($bindings);

    jsonResponse(['message' => 'Trip updated successfully']);
}

/**
 * DELETE /admin/trips/{id} - Soft delete (set status CANCELLED).
 */
function deleteTrip($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN', 'EMPLOYEE');

    $tripId = $params['id'] ?? '';
    $pdo = db();

    $stmt = $pdo->prepare("UPDATE trips SET status = 'CANCELLED', updated_at = NOW() WHERE id = ?");
    $stmt->execute([$tripId]);

    if ($stmt->rowCount() === 0) {
        jsonError('Trip not found', 404);
    }

    jsonResponse(['message' => 'Trip deleted successfully']);
}

/**
 * POST /admin/trips/{id}/images - Add images to trip.
 */
function addTripImages($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN', 'EMPLOYEE');

    $tripId = $params['id'] ?? '';
    $pdo = db();

    // Check trip exists
    $stmt = $pdo->prepare('SELECT id FROM trips WHERE id = ?');
    $stmt->execute([$tripId]);
    if (!$stmt->fetch()) {
        jsonError('Trip not found', 404);
    }

    // Handle file uploads
    if (empty($_FILES['images'])) {
        jsonError('No images uploaded', 400);
    }

    $files = $_FILES['images'];
    $uploadDir = UPLOAD_DIR . 'trips/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    // Get current max sort order
    $stmt = $pdo->prepare('SELECT COALESCE(MAX(sort_order), 0) FROM trip_images WHERE trip_id = ?');
    $stmt->execute([$tripId]);
    $sortOrder = (int) $stmt->fetchColumn();

    $uploaded = [];

    // Normalize file array for multiple files
    $fileCount = is_array($files['name']) ? count($files['name']) : 1;

    for ($i = 0; $i < $fileCount; $i++) {
        $name     = is_array($files['name']) ? $files['name'][$i] : $files['name'];
        $tmpName  = is_array($files['tmp_name']) ? $files['tmp_name'][$i] : $files['tmp_name'];
        $error    = is_array($files['error']) ? $files['error'][$i] : $files['error'];
        $size     = is_array($files['size']) ? $files['size'][$i] : $files['size'];

        if ($error !== UPLOAD_ERR_OK) continue;
        if ($size > MAX_UPLOAD_SIZE) continue;

        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif'])) continue;

        $filename = uuid() . '.' . $ext;
        $filepath = $uploadDir . $filename;

        if (move_uploaded_file($tmpName, $filepath)) {
            $sortOrder++;
            $imgId = uuid();
            $imageUrl = UPLOAD_URL . 'trips/' . $filename;

            $stmt = $pdo->prepare('INSERT INTO trip_images (id, trip_id, image_url, alt_text, sort_order, created_at) VALUES (?, ?, ?, ?, ?, NOW())');
            $stmt->execute([$imgId, $tripId, $imageUrl, $name, $sortOrder]);

            $uploaded[] = [
                'id'        => $imgId,
                'url'       => $imageUrl,
                'altText'   => $name,
                'sortOrder' => $sortOrder,
            ];
        }
    }

    jsonResponse(['images' => $uploaded], 201);
}

/**
 * DELETE /admin/trips/{id}/images/{imageId} - Remove image.
 */
function removeTripImage($params): void {
    $user = authenticate();
    requireRole($user, 'ADMIN', 'EMPLOYEE');

    $imageId = $params['imageId'] ?? '';
    $pdo = db();

    // Get image URL to delete file
    $stmt = $pdo->prepare('SELECT image_url FROM trip_images WHERE id = ?');
    $stmt->execute([$imageId]);
    $img = $stmt->fetch();

    if (!$img) {
        jsonError('Image not found', 404);
    }

    // Delete file from disk
    $filePath = __DIR__ . '/../' . ltrim($img['image_url'], '/');
    if (file_exists($filePath)) {
        unlink($filePath);
    }

    // Delete record
    $pdo->prepare('DELETE FROM trip_images WHERE id = ?')->execute([$imageId]);

    jsonResponse(['message' => 'Image removed successfully']);
}
