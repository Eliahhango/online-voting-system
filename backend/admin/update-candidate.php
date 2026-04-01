<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/admin-auth.php';
require_once __DIR__ . '/../helpers/sanitizer.php';
require_once __DIR__ . '/../helpers/validator.php';
require_once __DIR__ . '/../helpers/uploader.php';
require_once __DIR__ . '/../helpers/election-guard.php';

require_method(['POST', 'PUT', 'PATCH']);

$admin = require_admin_auth();
$input = get_json_input();

$candidateId = (int) ($input['candidate_id'] ?? query_param('candidate_id', 0));
if ($candidateId <= 0) {
    json_error('candidate_id is required', 422, ['candidate_id' => 'candidate_id is required']);
}

try {
    $pdo = db();

    $existingStmt = $pdo->prepare('SELECT * FROM candidates WHERE id = :id LIMIT 1');
    $existingStmt->execute(['id' => $candidateId]);
    $existing = $existingStmt->fetch();
    if (!$existing) {
        json_error('Candidate not found', 404);
    }

    $sourceElectionId = (int) $existing['election_id'];
    $sourceElectionStmt = $pdo->prepare('SELECT id, status, start_at, end_at FROM elections WHERE id = :id LIMIT 1');
    $sourceElectionStmt->execute(['id' => $sourceElectionId]);
    $sourceElection = $sourceElectionStmt->fetch();
    if (!$sourceElection) {
        json_error('Source election not found', 404);
    }

    $sourceBallots = election_ballots_count($pdo, $sourceElectionId);
    if (election_structure_locked($sourceElection, $sourceBallots)) {
        json_error('Candidate records are locked for this election', 409, [
            'candidate_id' => 'Cannot update candidates after election has started, closed, or received ballots',
        ]);
    }

    $fields = [];
    $params = ['id' => $candidateId];
    $errors = [];

    if (array_key_exists('full_name', $input)) {
        $name = sanitize_string($input['full_name'], 120);
        if ($name === '') {
            $errors['full_name'] = 'full_name cannot be empty';
        } else {
            $fields[] = 'full_name = :full_name';
            $params['full_name'] = $name;
        }
    }

    if (array_key_exists('party', $input)) {
        $fields[] = 'party = :party';
        $params['party'] = sanitize_nullable_string($input['party'], 120);
    }

    if (array_key_exists('bio', $input)) {
        $fields[] = 'bio = :bio';
        $params['bio'] = sanitize_nullable_string($input['bio'], 2000);
    }

    if (array_key_exists('manifesto', $input)) {
        $fields[] = 'manifesto = :manifesto';
        $params['manifesto'] = sanitize_nullable_string($input['manifesto'], 5000);
    }

    if (array_key_exists('status', $input)) {
        $status = strtolower(trim((string) $input['status']));
        $statusError = validate_enum_value($status, ['active', 'inactive'], 'status');
        if ($statusError !== null) {
            $errors['status'] = $statusError;
        } else {
            $fields[] = 'status = :status';
            $params['status'] = $status;
        }
    }

    $newElectionId = null;
    $newPositionId = null;
    if (array_key_exists('election_id', $input)) {
        $newElectionId = sanitize_int($input['election_id']);
        if ($newElectionId <= 0) {
            $errors['election_id'] = 'election_id must be a valid integer';
        }
    }

    if (array_key_exists('position_id', $input)) {
        $newPositionId = sanitize_int($input['position_id']);
        if ($newPositionId <= 0) {
            $errors['position_id'] = 'position_id must be a valid integer';
        }
    }

    if (!empty($errors)) {
        json_error('Validation failed', 422, $errors);
    }

    $finalElectionId = $newElectionId ?? (int) $existing['election_id'];
    $finalPositionId = $newPositionId ?? (int) $existing['position_id'];

    if ($finalElectionId !== $sourceElectionId) {
        $targetElectionStmt = $pdo->prepare('SELECT id, status, start_at, end_at FROM elections WHERE id = :id LIMIT 1');
        $targetElectionStmt->execute(['id' => $finalElectionId]);
        $targetElection = $targetElectionStmt->fetch();
        if (!$targetElection) {
            json_error('Target election not found', 404);
        }

        $targetBallots = election_ballots_count($pdo, $finalElectionId);
        if (election_structure_locked($targetElection, $targetBallots)) {
            json_error('Target election is locked for candidate updates', 409, [
                'election_id' => 'Cannot move candidate into an election that has started, closed, or received ballots',
            ]);
        }
    }

    if ($newElectionId !== null || $newPositionId !== null) {
        $positionStmt = $pdo->prepare('SELECT id, election_id FROM positions WHERE id = :id LIMIT 1');
        $positionStmt->execute(['id' => $finalPositionId]);
        $position = $positionStmt->fetch();

        if (!$position) {
            json_error('Target position not found', 404);
        }

        if ((int) $position['election_id'] !== $finalElectionId) {
            json_error('position_id does not belong to election_id', 422);
        }

        $fields[] = 'election_id = :election_id';
        $fields[] = 'position_id = :position_id';
        $params['election_id'] = $finalElectionId;
        $params['position_id'] = $finalPositionId;
    }

    $cfg = app_config();
    $filename = upload_image('photo', $cfg['candidate_upload_dir']);
    if ($filename !== null) {
        $fields[] = 'photo_path = :photo_path';
        $params['photo_path'] = $filename;
    }

    if (empty($fields)) {
        json_error('No fields provided for update', 422);
    }

    $sql = 'UPDATE candidates SET ' . implode(', ', $fields) . ' WHERE id = :id';
    $updateStmt = $pdo->prepare($sql);
    $updateStmt->execute($params);

    audit_log('admin.update_candidate', (int) $admin['id'], ['candidate_id' => $candidateId]);

    $refetch = $pdo->prepare('SELECT * FROM candidates WHERE id = :id LIMIT 1');
    $refetch->execute(['id' => $candidateId]);

    json_success(['candidate' => $refetch->fetch()], 'Candidate updated successfully');
} catch (Throwable $e) {
    app_log('error', 'Update candidate failed', ['error' => $e->getMessage(), 'admin_id' => (int) $admin['id']]);
    json_error('Unable to update candidate', 500);
}
