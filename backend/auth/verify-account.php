<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/logger.php';
require_once __DIR__ . '/../middleware/cors.php';

require_method('POST');

$input = get_json_input();
$token = trim((string) ($input['token'] ?? ''));

if ($token === '') {
    json_error('Verification token is required', 422, ['token' => 'Verification token is required']);
}

try {
    $stmt = db()->prepare(
        'UPDATE users
         SET is_verified = 1, verification_token = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE verification_token = :token'
    );

    $stmt->execute(['token' => $token]);

    if ($stmt->rowCount() === 0) {
        json_error('Invalid verification token', 400);
    }

    audit_log('auth.verify_account', null, ['token_used' => true]);

    json_success([], 'Account verified successfully');
} catch (Throwable $e) {
    app_log('error', 'Verify account failed', ['error' => $e->getMessage()]);
    json_error('Unable to verify account', 500);
}
