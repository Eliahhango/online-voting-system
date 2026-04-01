<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/admin-auth.php';
require_once __DIR__ . '/../helpers/sanitizer.php';
require_once __DIR__ . '/../helpers/validator.php';
require_once __DIR__ . '/../helpers/election-guard.php';

require_method('POST');

$admin = require_admin_auth();
$input = get_json_input();

$electionId = sanitize_int($input['election_id'] ?? 0);
$parentPositionIdRaw = sanitize_int($input['parent_position_id'] ?? 0, 0);
$parentPositionId = $parentPositionIdRaw > 0 ? $parentPositionIdRaw : null;
$title = sanitize_string($input['title'] ?? '', 160);
$seatCount = max(1, sanitize_int($input['seat_count'] ?? 1, 1));
$sortOrder = max(0, sanitize_int($input['sort_order'] ?? 0, 0));
$description = sanitize_nullable_string($input['description'] ?? '', 2000);

$errors = require_fields([
    'election_id' => $electionId,
    'title' => $title,
], ['election_id', 'title']);

if ($electionId <= 0) {
    $errors['election_id'] = 'election_id must be a valid integer';
}

if (!empty($errors)) {
    json_error('Validation failed', 422, $errors);
}

try {
    $pdo = db();

    $exists = $pdo->prepare('SELECT id, status, start_at, end_at FROM elections WHERE id = :id LIMIT 1');
    $exists->execute(['id' => $electionId]);
    $election = $exists->fetch();
    if (!$election) {
        json_error('Election not found', 404);
    }

    $ballotsCount = election_ballots_count($pdo, $electionId);
    if (election_structure_locked($election, $ballotsCount)) {
        json_error('Election structure is locked for editing', 409, [
            'election_id' => 'Cannot add positions after election has started, closed, or received ballots',
        ]);
    }

    if ($parentPositionId !== null) {
        $parentStmt = $pdo->prepare(
            'SELECT id, election_id FROM positions WHERE id = :id LIMIT 1'
        );
        $parentStmt->execute(['id' => $parentPositionId]);
        $parent = $parentStmt->fetch();
        if (!$parent) {
            json_error('Parent position not found', 404, ['parent_position_id' => 'parent_position_id not found']);
        }
        if ((int) $parent['election_id'] !== $electionId) {
            json_error('parent_position_id does not belong to election_id', 422, [
                'parent_position_id' => 'Parent position must be inside the same election',
            ]);
        }
    }

    if ($sortOrder <= 0) {
        if ($parentPositionId === null) {
            $orderStmt = $pdo->prepare(
                'SELECT COALESCE(MAX(sort_order), 0) + 1 FROM positions WHERE election_id = :election_id AND parent_position_id IS NULL'
            );
            $orderStmt->execute(['election_id' => $electionId]);
        } else {
            $orderStmt = $pdo->prepare(
                'SELECT COALESCE(MAX(sort_order), 0) + 1 FROM positions WHERE election_id = :election_id AND parent_position_id = :parent_position_id'
            );
            $orderStmt->execute([
                'election_id' => $electionId,
                'parent_position_id' => $parentPositionId,
            ]);
        }
        $sortOrder = (int) $orderStmt->fetchColumn();
    }

    $stmt = $pdo->prepare(
        'INSERT INTO positions (election_id, parent_position_id, title, seat_count, sort_order, description, created_at)
         VALUES (:election_id, :parent_position_id, :title, :seat_count, :sort_order, :description, CURRENT_TIMESTAMP)'
    );

    $stmt->execute([
        'election_id' => $electionId,
        'parent_position_id' => $parentPositionId,
        'title' => $title,
        'seat_count' => $seatCount,
        'sort_order' => $sortOrder,
        'description' => $description,
    ]);

    $positionId = (int) $pdo->lastInsertId();

    audit_log('admin.create_position', (int) $admin['id'], [
        'position_id' => $positionId,
        'election_id' => $electionId,
        'parent_position_id' => $parentPositionId,
    ]);

    json_success([
        'position_id' => $positionId,
        'parent_position_id' => $parentPositionId,
    ], 'Position created successfully', 201);
} catch (Throwable $e) {
    app_log('error', 'Create position failed', ['error' => $e->getMessage(), 'admin_id' => (int) $admin['id']]);
    json_error('Unable to create position', 500);
}
