<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/sanitizer.php';
require_once __DIR__ . '/../helpers/validator.php';
require_once __DIR__ . '/../helpers/logger.php';
require_once __DIR__ . '/../middleware/cors.php';

require_method('POST');

function generate_unique_voter_id(PDO $pdo): string
{
    for ($i = 0; $i < 30; $i++) {
        $candidate = (string) random_int(100000000, 999999999);
        $check = $pdo->prepare('SELECT id FROM users WHERE voter_id = :voter_id LIMIT 1');
        $check->execute(['voter_id' => $candidate]);
        if (!$check->fetch()) {
            return $candidate;
        }
    }

    throw new RuntimeException('Unable to generate a unique voter ID');
}

function is_voter_id_unique_constraint(Throwable $e): bool
{
    $msg = strtolower($e->getMessage());
    return strpos($msg, 'unique') !== false && strpos($msg, 'voter_id') !== false;
}

$input = get_json_input();

$fullName = sanitize_string($input['full_name'] ?? '', 120);
$email = sanitize_email($input['email'] ?? '');
$phone = sanitize_nullable_string($input['phone'] ?? '', 30);
$password = (string) ($input['password'] ?? '');

$errors = require_fields([
    'full_name' => $fullName,
    'email' => $email,
    'password' => $password,
], ['full_name', 'email', 'password']);

$emailError = validate_email_format($email);
if ($emailError !== null) {
    $errors['email'] = $emailError;
}

$passwordError = validate_password_strength($password);
if ($passwordError !== null) {
    $errors['password'] = $passwordError;
}

if (!empty($errors)) {
    json_error('Validation failed', 422, $errors);
}

try {
    $pdo = db();

    $check = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
    $check->execute(['email' => $email]);
    if ($check->fetch()) {
        json_error('Email is already registered', 409);
    }

    $verificationToken = bin2hex(random_bytes(20));

    $stmt = $pdo->prepare(
        'INSERT INTO users (full_name, email, phone, voter_id, password_hash, role, status, is_verified, verification_token, created_at, updated_at)
         VALUES (:full_name, :email, :phone, :voter_id, :password_hash, :role, :status, :is_verified, :verification_token, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
    );

    $userId = 0;
    $voterId = null;
    for ($attempt = 0; $attempt < 6; $attempt++) {
        $voterId = generate_unique_voter_id($pdo);
        try {
            $stmt->execute([
                'full_name' => $fullName,
                'email' => $email,
                'phone' => $phone,
                'voter_id' => $voterId,
                'password_hash' => password_hash($password, PASSWORD_BCRYPT),
                'role' => USER_ROLE_VOTER,
                'status' => USER_STATUS_ACTIVE,
                'is_verified' => 0,
                'verification_token' => $verificationToken,
            ]);
            $userId = (int) $pdo->lastInsertId();
            break;
        } catch (Throwable $insertError) {
            if ($attempt < 5 && is_voter_id_unique_constraint($insertError)) {
                continue;
            }
            throw $insertError;
        }
    }

    if ($userId <= 0 || $voterId === null) {
        throw new RuntimeException('Unable to create user account');
    }

    audit_log('auth.register', $userId, ['email' => $email]);

    $payload = [
        'user_id' => $userId,
        'voter_id' => $voterId,
        'role' => USER_ROLE_VOTER,
        'requires_verification' => true,
    ];

    if (!is_production()) {
        $payload['verification_token'] = $verificationToken;
    }

    json_success($payload, 'Registration successful', 201);
} catch (Throwable $e) {
    app_log('error', 'Register failed', ['error' => $e->getMessage()]);
    json_error('Unable to register user at this time', 500);
}
