<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/admin-auth.php';
require_once __DIR__ . '/../helpers/validator.php';
require_once __DIR__ . '/../helpers/sanitizer.php';

require_method(['POST', 'PATCH', 'PUT']);

$admin = require_admin_auth();
$input = get_json_input();

$voterUserId = (int) ($input['voter_user_id'] ?? ($input['user_id'] ?? 0));
$voterRegistrationId = sanitize_nullable_string($input['voter_id'] ?? '', 80);
$status = strtolower(trim((string) ($input['status'] ?? '')));

$errors = [];
if ($voterUserId <= 0 && ($voterRegistrationId === null || $voterRegistrationId === '')) {
    $errors['voter_id'] = 'Provide voter_user_id (or user_id) or voter_id';
}

$statusError = validate_enum_value($status, [USER_STATUS_ACTIVE, USER_STATUS_INACTIVE, USER_STATUS_SUSPENDED], 'status');
if ($statusError !== null) {
    $errors['status'] = $statusError;
}

if (!empty($errors)) {
    json_error('Validation failed', 422, $errors);
}

try {
    $pdo = db();

    if ($voterUserId > 0) {
        $stmt = $pdo->prepare("SELECT id, role, status, voter_id FROM users WHERE id = :id AND role = 'voter' LIMIT 1");
        $stmt->execute(['id' => $voterUserId]);
    } else {
        $stmt = $pdo->prepare("SELECT id, role, status, voter_id FROM users WHERE voter_id = :voter_id AND role = 'voter' LIMIT 1");
        $stmt->execute(['voter_id' => (string) $voterRegistrationId]);
    }
    $voter = $stmt->fetch();

    if (!$voter) {
        json_error('Voter not found', 404);
    }

    $updateStmt = $pdo->prepare('UPDATE users SET status = :status, updated_at = CURRENT_TIMESTAMP WHERE id = :id');
    $updateStmt->execute([
        'status' => $status,
        'id' => (int) $voter['id'],
    ]);

    audit_log('admin.update_voter_status', (int) $admin['id'], [
        'voter_id' => (int) $voter['id'],
        'voter_registration_id' => $voter['voter_id'] ?? null,
        'from' => $voter['status'],
        'to' => $status,
    ]);

    json_success([
        'voter_id' => (int) $voter['id'],
        'voter_registration_id' => $voter['voter_id'] ?? null,
        'status' => $status,
    ], 'Voter status updated successfully');
} catch (Throwable $e) {
    app_log('error', 'Update voter status failed', ['error' => $e->getMessage(), 'admin_id' => (int) $admin['id']]);
    json_error('Unable to update voter status', 500);
}
