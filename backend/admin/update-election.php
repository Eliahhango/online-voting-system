<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/admin-auth.php';
require_once __DIR__ . '/../helpers/sanitizer.php';
require_once __DIR__ . '/../helpers/validator.php';
require_once __DIR__ . '/../helpers/election-guard.php';

require_method(['POST', 'PUT', 'PATCH']);

$admin = require_admin_auth();
$input = get_json_input();

$electionId = (int) ($input['election_id'] ?? query_param('election_id', 0));
if ($electionId <= 0) {
    json_error('election_id is required', 422, ['election_id' => 'election_id is required']);
}

$fields = [];
$params = ['id' => $electionId];
$errors = [];
$requestedUpdates = [
    'title' => false,
    'description' => false,
    'start_at' => false,
    'end_at' => false,
    'status' => false,
    'visibility' => false,
];

$reviewConfirmed = null;
if (array_key_exists('review_confirmed', $input)) {
    $rawReview = $input['review_confirmed'];
    if (is_bool($rawReview)) {
        $reviewConfirmed = $rawReview;
    } else {
        $normalized = strtolower(trim((string) $rawReview));
        $reviewConfirmed = in_array($normalized, ['1', 'true', 'yes', 'on'], true);
    }
}

if (array_key_exists('title', $input)) {
    $requestedUpdates['title'] = true;
    $title = sanitize_string($input['title'], 180);
    if ($title === '') {
        $errors['title'] = 'title cannot be empty';
    } else {
        $fields[] = 'title = :title';
        $params['title'] = $title;
    }
}

if (array_key_exists('description', $input)) {
    $requestedUpdates['description'] = true;
    $description = sanitize_nullable_string($input['description'], 4000);
    if ($description === null || trim((string) $description) === '') {
        $errors['description'] = 'description cannot be empty';
    }
    $fields[] = 'description = :description';
    $params['description'] = $description;
}

$startAt = null;
$endAt = null;
if (array_key_exists('start_at', $input)) {
    $requestedUpdates['start_at'] = true;
    $startAt = trim((string) $input['start_at']);
    $err = validate_datetime_string($startAt, 'start_at');
    if ($err !== null) {
        $errors['start_at'] = $err;
    } else {
        $fields[] = 'start_at = :start_at';
        $params['start_at'] = date('Y-m-d H:i:s', strtotime($startAt));
    }
}

if (array_key_exists('end_at', $input)) {
    $requestedUpdates['end_at'] = true;
    $endAt = trim((string) $input['end_at']);
    $err = validate_datetime_string($endAt, 'end_at');
    if ($err !== null) {
        $errors['end_at'] = $err;
    } else {
        $fields[] = 'end_at = :end_at';
        $params['end_at'] = date('Y-m-d H:i:s', strtotime($endAt));
    }
}

if (array_key_exists('status', $input)) {
    $requestedUpdates['status'] = true;
    $status = strtolower(trim((string) $input['status']));
    $err = validate_enum_value($status, [ELECTION_STATUS_DRAFT, ELECTION_STATUS_PUBLISHED, ELECTION_STATUS_CLOSED], 'status');
    if ($err !== null) {
        $errors['status'] = $err;
    } else {
        $fields[] = 'status = :status';
        $params['status'] = $status;
    }
}

if (array_key_exists('visibility', $input)) {
    $requestedUpdates['visibility'] = true;
    $visibility = strtolower(trim((string) $input['visibility']));
    $err = validate_enum_value($visibility, [VISIBILITY_PUBLIC, VISIBILITY_PRIVATE], 'visibility');
    if ($err !== null) {
        $errors['visibility'] = $err;
    } else {
        $fields[] = 'visibility = :visibility';
        $params['visibility'] = $visibility;
    }
}

if (!empty($errors)) {
    json_error('Validation failed', 422, $errors);
}

if (empty($fields)) {
    json_error('No fields provided for update', 422);
}

try {
    $pdo = db();

    $exists = $pdo->prepare('SELECT id, title, description, start_at, end_at, status, visibility FROM elections WHERE id = :id LIMIT 1');
    $exists->execute(['id' => $electionId]);
    $existing = $exists->fetch();
    if (!$existing) {
        json_error('Election not found', 404);
    }

    $finalStartAt = $startAt !== null ? date('Y-m-d H:i:s', strtotime($startAt)) : (string) $existing['start_at'];
    $finalEndAt = $endAt !== null ? date('Y-m-d H:i:s', strtotime($endAt)) : (string) $existing['end_at'];
    $finalStatus = array_key_exists('status', $params) ? (string) $params['status'] : (string) $existing['status'];
    $isPublishTransition = $requestedUpdates['status']
        && $finalStatus === ELECTION_STATUS_PUBLISHED
        && (string) $existing['status'] !== ELECTION_STATUS_PUBLISHED;

    if (strtotime($finalStartAt) === false || strtotime($finalEndAt) === false || strtotime($finalStartAt) >= strtotime($finalEndAt)) {
        $errors['end_at'] = 'end_at must be later than start_at';
    }

    $ballotsCount = election_ballots_count($pdo, $electionId);
    $structuralLocked = election_structure_locked($existing, $ballotsCount);
    $isTryingStructuralChange = $requestedUpdates['title'] || $requestedUpdates['description'] || $requestedUpdates['start_at'] || $requestedUpdates['end_at'] || $requestedUpdates['visibility'];

    if ($structuralLocked && $isTryingStructuralChange) {
        json_error(
            'Election structure is locked',
            409,
            ['election' => 'Started/closed elections or elections with ballots cannot change title/description/dates/visibility']
        );
    }

    if ((string) $existing['status'] === ELECTION_STATUS_CLOSED && $requestedUpdates['status'] && $finalStatus !== ELECTION_STATUS_CLOSED) {
        json_error('Closed elections cannot be reopened', 409, ['status' => 'status must remain closed']);
    }

    if ($ballotsCount > 0 && $requestedUpdates['status'] && $finalStatus !== ELECTION_STATUS_CLOSED && $finalStatus !== (string) $existing['status']) {
        json_error('Election with ballots cannot change to a non-closed status', 409, ['status' => 'Only closed status is allowed once ballots exist']);
    }

    if ($requestedUpdates['status'] && $finalStatus === ELECTION_STATUS_DRAFT && $ballotsCount > 0) {
        json_error('Election with ballots cannot be moved back to draft', 409, ['status' => 'status cannot be draft once ballots exist']);
    }

    if ($isPublishTransition && $reviewConfirmed !== true) {
        json_error(
            'Review Election step must be completed before publishing',
            422,
            ['review_confirmed' => 'Set review_confirmed=true after validating positions and candidates']
        );
    }

    if ($finalStatus === ELECTION_STATUS_PUBLISHED) {
        $readiness = election_publish_readiness($pdo, $electionId);
        if (!$readiness['ok']) {
            json_error('Election is not ready to publish', 422, $readiness['errors'], [
                'requirements' => $readiness['meta'],
            ]);
        }

        $conflict = election_find_overlapping_published($pdo, $finalStartAt, $finalEndAt, $electionId);
        if ($conflict) {
            json_error(
                'Election window overlaps with another published election',
                409,
                ['start_at' => 'Overlaps with #' . (int) $conflict['id'] . ' (' . (string) $conflict['title'] . ')']
            );
        }
    }

    if (!empty($errors)) {
        json_error('Validation failed', 422, $errors);
    }

    $fields[] = 'updated_at = CURRENT_TIMESTAMP';
    $sql = 'UPDATE elections SET ' . implode(', ', $fields) . ' WHERE id = :id';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    audit_log('admin.update_election', (int) $admin['id'], ['election_id' => $electionId]);

    $refetch = $pdo->prepare('SELECT * FROM elections WHERE id = :id LIMIT 1');
    $refetch->execute(['id' => $electionId]);

    json_success(['election' => $refetch->fetch()], 'Election updated successfully');
} catch (Throwable $e) {
    app_log('error', 'Update election failed', ['error' => $e->getMessage(), 'admin_id' => (int) $admin['id']]);
    json_error('Unable to update election', 500);
}
