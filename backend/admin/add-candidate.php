<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/admin-auth.php';
require_once __DIR__ . '/../helpers/sanitizer.php';
require_once __DIR__ . '/../helpers/validator.php';
require_once __DIR__ . '/../helpers/uploader.php';
require_once __DIR__ . '/../helpers/election-guard.php';

require_method('POST');

$admin = require_admin_auth();
$input = get_json_input();

$electionId = sanitize_int($input['election_id'] ?? 0);
$positionId = sanitize_int($input['position_id'] ?? 0);
$fullName = sanitize_string($input['full_name'] ?? '', 120);
$party = sanitize_nullable_string($input['party'] ?? '', 120);
$bio = sanitize_nullable_string($input['bio'] ?? '', 2000);
$manifesto = sanitize_nullable_string($input['manifesto'] ?? '', 5000);
$status = strtolower(trim((string) ($input['status'] ?? 'active')));

$errors = require_fields([
    'election_id' => $electionId,
    'position_id' => $positionId,
    'full_name' => $fullName,
], ['election_id', 'position_id', 'full_name']);

if ($electionId <= 0) {
    $errors['election_id'] = 'election_id must be a valid integer';
}
if ($positionId <= 0) {
    $errors['position_id'] = 'position_id must be a valid integer';
}

$statusError = validate_enum_value($status, ['active', 'inactive'], 'status');
if ($statusError !== null) {
    $errors['status'] = $statusError;
}

if (!empty($errors)) {
    json_error('Validation failed', 422, $errors);
}

try {
    $pdo = db();

    $electionStmt = $pdo->prepare('SELECT id, status, start_at, end_at FROM elections WHERE id = :id LIMIT 1');
    $electionStmt->execute(['id' => $electionId]);
    $election = $electionStmt->fetch();
    if (!$election) {
        json_error('Election not found', 404);
    }

    $ballotsCount = election_ballots_count($pdo, $electionId);
    if (election_structure_locked($election, $ballotsCount)) {
        json_error('Election structure is locked for editing', 409, [
            'election_id' => 'Cannot add candidates after election has started, closed, or received ballots',
        ]);
    }

    $positionStmt = $pdo->prepare('SELECT id, election_id FROM positions WHERE id = :id LIMIT 1');
    $positionStmt->execute(['id' => $positionId]);
    $position = $positionStmt->fetch();

    if (!$position) {
        json_error('Position not found', 404);
    }

    if ((int) $position['election_id'] !== $electionId) {
        json_error('position_id does not belong to election_id', 422);
    }

    $cfg = app_config();
    $filename = upload_image('photo', $cfg['candidate_upload_dir']);

    $stmt = $pdo->prepare(
        'INSERT INTO candidates (election_id, position_id, full_name, party, bio, photo_path, manifesto, status, created_at)
         VALUES (:election_id, :position_id, :full_name, :party, :bio, :photo_path, :manifesto, :status, CURRENT_TIMESTAMP)'
    );

    $stmt->execute([
        'election_id' => $electionId,
        'position_id' => $positionId,
        'full_name' => $fullName,
        'party' => $party,
        'bio' => $bio,
        'photo_path' => $filename,
        'manifesto' => $manifesto,
        'status' => $status,
    ]);

    $candidateId = (int) $pdo->lastInsertId();

    audit_log('admin.add_candidate', (int) $admin['id'], [
        'candidate_id' => $candidateId,
        'election_id' => $electionId,
        'position_id' => $positionId,
    ]);

    json_success(['candidate_id' => $candidateId, 'photo_file' => $filename], 'Candidate added successfully', 201);
} catch (Throwable $e) {
    app_log('error', 'Add candidate failed', ['error' => $e->getMessage(), 'admin_id' => (int) $admin['id']]);
    json_error('Unable to add candidate', 500);
}
