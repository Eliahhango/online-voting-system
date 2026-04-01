<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/admin-auth.php';
require_once __DIR__ . '/../helpers/validator.php';

require_method(['POST', 'PATCH', 'PUT']);

$admin = require_admin_auth();
$input = get_json_input();

$voterId = (int) ($input['voter_id'] ?? 0);
$status = strtolower(trim((string) ($input['status'] ?? '')));

$errors = [];
if ($voterId <= 0) {
    $errors['voter_id'] = 'voter_id is required and must be an integer';
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

    $stmt = $pdo->prepare("SELECT id, role, status FROM users WHERE id = :id AND role = 'voter' LIMIT 1");
    $stmt->execute(['id' => $voterId]);
    $voter = $stmt->fetch();

    if (!$voter) {
        json_error('Voter not found', 404);
    }

    $updateStmt = $pdo->prepare('UPDATE users SET status = :status, updated_at = CURRENT_TIMESTAMP WHERE id = :id');
    $updateStmt->execute([
        'status' => $status,
        'id' => $voterId,
    ]);

    audit_log('admin.update_voter_status', (int) $admin['id'], [
        'voter_id' => $voterId,
        'from' => $voter['status'],
        'to' => $status,
    ]);

    json_success([
        'voter_id' => $voterId,
        'status' => $status,
    ], 'Voter status updated successfully');
} catch (Throwable $e) {
    app_log('error', 'Update voter status failed', ['error' => $e->getMessage(), 'admin_id' => (int) $admin['id']]);
    json_error('Unable to update voter status', 500);
}
