<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/validator.php';
require_once __DIR__ . '/../helpers/logger.php';
require_once __DIR__ . '/../middleware/cors.php';

require_method('POST');

$input = get_json_input();
$token = trim((string) ($input['token'] ?? ''));
$newPassword = (string) ($input['new_password'] ?? '');

$errors = require_fields([
    'token' => $token,
    'new_password' => $newPassword,
], ['token', 'new_password']);

$passwordError = validate_password_strength($newPassword);
if ($passwordError !== null) {
    $errors['new_password'] = $passwordError;
}

if (!empty($errors)) {
    json_error('Validation failed', 422, $errors);
}

try {
    $pdo = db();
    $tokenHash = hash('sha256', $token);

    $stmt = $pdo->prepare(
        'SELECT id, user_id, expires_at, used_at
         FROM password_resets
         WHERE token_hash = :token_hash
         ORDER BY id DESC
         LIMIT 1'
    );
    $stmt->execute(['token_hash' => $tokenHash]);
    $row = $stmt->fetch();

    if (!$row) {
        json_error('Invalid reset token', 400);
    }

    if (!empty($row['used_at'])) {
        json_error('Reset token has already been used', 400);
    }

    if (strtotime((string) $row['expires_at']) < time()) {
        json_error('Reset token has expired', 400);
    }

    $pdo->beginTransaction();

    $updateUser = $pdo->prepare('UPDATE users SET password_hash = :password_hash, updated_at = CURRENT_TIMESTAMP WHERE id = :id');
    $updateUser->execute([
        'password_hash' => password_hash($newPassword, PASSWORD_BCRYPT),
        'id' => (int) $row['user_id'],
    ]);

    $markUsed = $pdo->prepare('UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE user_id = :user_id AND used_at IS NULL');
    $markUsed->execute(['user_id' => (int) $row['user_id']]);

    $pdo->commit();

    audit_log('auth.reset_password', (int) $row['user_id']);

    json_success([], 'Password has been reset successfully');
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    app_log('error', 'Reset password failed', ['error' => $e->getMessage()]);
    json_error('Unable to reset password', 500);
}
