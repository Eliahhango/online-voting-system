<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/admin-auth.php';
require_once __DIR__ . '/../helpers/sanitizer.php';
require_once __DIR__ . '/../helpers/validator.php';
require_once __DIR__ . '/../helpers/election-guard.php';

require_method('POST');

$admin = require_admin_auth();
$input = get_json_input();

$title = sanitize_string($input['title'] ?? '', 180);
$description = sanitize_nullable_string($input['description'] ?? '', 4000);
$startAt = trim((string) ($input['start_at'] ?? ''));
$endAt = trim((string) ($input['end_at'] ?? ''));
$status = strtolower(trim((string) ($input['status'] ?? ELECTION_STATUS_DRAFT)));
$visibility = strtolower(trim((string) ($input['visibility'] ?? VISIBILITY_PUBLIC)));

$errors = require_fields([
    'title' => $title,
    'description' => $description,
    'start_at' => $startAt,
    'end_at' => $endAt,
], ['title', 'description', 'start_at', 'end_at']);

if ($description !== null && trim((string) $description) === '') {
    $errors['description'] = 'description is required';
}

$startError = validate_datetime_string($startAt, 'start_at');
if ($startError !== null) {
    $errors['start_at'] = $startError;
}

$endError = validate_datetime_string($endAt, 'end_at');
if ($endError !== null) {
    $errors['end_at'] = $endError;
}

$statusError = validate_enum_value($status, [ELECTION_STATUS_DRAFT, ELECTION_STATUS_PUBLISHED, ELECTION_STATUS_CLOSED], 'status');
if ($statusError !== null) {
    $errors['status'] = $statusError;
}

$visibilityError = validate_enum_value($visibility, [VISIBILITY_PUBLIC, VISIBILITY_PRIVATE], 'visibility');
if ($visibilityError !== null) {
    $errors['visibility'] = $visibilityError;
}

if (strtotime($startAt) !== false && strtotime($endAt) !== false && strtotime($startAt) >= strtotime($endAt)) {
    $errors['end_at'] = 'end_at must be later than start_at';
}

if (!empty($errors)) {
    json_error('Validation failed', 422, $errors);
}

try {
    $pdo = db();
    $normalizedStartAt = date('Y-m-d H:i:s', strtotime($startAt));
    $normalizedEndAt = date('Y-m-d H:i:s', strtotime($endAt));

    if ($status === ELECTION_STATUS_PUBLISHED) {
        json_error(
            'Cannot publish during creation. Create as draft, then add positions and candidates before publishing.',
            422,
            [
                'status' => 'Use draft first, then publish from edit screen after setup',
            ]
        );
    }

    $stmt = $pdo->prepare(
        'INSERT INTO elections (title, description, start_at, end_at, status, visibility, created_by, created_at, updated_at)
         VALUES (:title, :description, :start_at, :end_at, :status, :visibility, :created_by, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
    );

    $stmt->execute([
        'title' => $title,
        'description' => $description,
        'start_at' => $normalizedStartAt,
        'end_at' => $normalizedEndAt,
        'status' => $status,
        'visibility' => $visibility,
        'created_by' => (int) $admin['id'],
    ]);

    $id = (int) $pdo->lastInsertId();

    audit_log('admin.create_election', (int) $admin['id'], ['election_id' => $id]);

    json_success(['election_id' => $id], 'Election created successfully', 201);
} catch (Throwable $e) {
    app_log('error', 'Create election failed', ['error' => $e->getMessage(), 'admin_id' => (int) $admin['id']]);
    json_error('Unable to create election', 500);
}
