<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/sanitizer.php';
require_once __DIR__ . '/../helpers/validator.php';
require_once __DIR__ . '/../helpers/logger.php';
require_once __DIR__ . '/../middleware/cors.php';

require_method('POST');

$input = get_json_input();
$identifier = sanitize_string($input['identifier'] ?? '', 150);
$email = sanitize_email($input['email'] ?? '');
$voterId = sanitize_nullable_string($input['voter_id'] ?? '', 80);

if ($identifier !== '') {
    if (strpos($identifier, '@') !== false) {
        $email = sanitize_email($identifier);
    } else {
        $voterId = sanitize_string($identifier, 80);
    }
}

$errors = [];
if ($email === '' && ($voterId === null || $voterId === '')) {
    $errors['identifier'] = 'Email or voter ID is required';
}

if ($email !== '') {
    $emailError = validate_email_format($email);
    if ($emailError !== null) {
        $errors['email'] = $emailError;
    }
}

if (!empty($errors)) {
    json_error('Validation failed', 422, $errors);
}

try {
    $pdo = db();

    if ($email !== '') {
        $stmt = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $stmt->execute(['email' => $email]);
    } else {
        $stmt = $pdo->prepare('SELECT id FROM users WHERE voter_id = :voter_id LIMIT 1');
        $stmt->execute(['voter_id' => $voterId]);
    }

    $user = $stmt->fetch();

    $response = [
        'message' => 'If the email exists, a reset token has been issued',
    ];

    if ($user) {
        $token = bin2hex(random_bytes(24));
        $tokenHash = hash('sha256', $token);
        $expiresAt = date('Y-m-d H:i:s', time() + (30 * 60));

        $insert = $pdo->prepare(
            'INSERT INTO password_resets (user_id, token_hash, expires_at, created_at)
             VALUES (:user_id, :token_hash, :expires_at, CURRENT_TIMESTAMP)'
        );

        $insert->execute([
            'user_id' => (int) $user['id'],
            'token_hash' => $tokenHash,
            'expires_at' => $expiresAt,
        ]);

        audit_log('auth.forgot_password', (int) $user['id']);

        if (!is_production()) {
            $response['debug_reset_token'] = $token;
            $response['expires_at'] = $expiresAt;
        }
    }

    json_success($response, 'Password reset request accepted');
} catch (Throwable $e) {
    app_log('error', 'Forgot password failed', ['error' => $e->getMessage()]);
    json_error('Unable to process password reset request', 500);
}
