<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/admin-auth.php';
require_once __DIR__ . '/../helpers/sanitizer.php';
require_once __DIR__ . '/../helpers/validator.php';

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

$admin = require_admin_auth();
$input = get_json_input();

$fullName = sanitize_string($input['full_name'] ?? '', 120);
$email = sanitize_email($input['email'] ?? '');
$phone = sanitize_nullable_string($input['phone'] ?? '', 30);
$voterId = sanitize_nullable_string($input['voter_id'] ?? '', 50);
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

    $emailExists = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
    $emailExists->execute(['email' => $email]);
    if ($emailExists->fetch()) {
        json_error('Email is already in use', 409);
    }

    if ($voterId !== null) {
        $voterExists = $pdo->prepare('SELECT id FROM users WHERE voter_id = :voter_id LIMIT 1');
        $voterExists->execute(['voter_id' => $voterId]);
        if ($voterExists->fetch()) {
            json_error('Voter ID is already in use', 409);
        }
    }

    $stmt = $pdo->prepare(
        'INSERT INTO users (full_name, email, phone, voter_id, password_hash, role, status, is_verified, created_at, updated_at)
         VALUES (:full_name, :email, :phone, :voter_id, :password_hash, :role, :status, :is_verified, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
    );

    $effectiveVoterId = $voterId;
    $voterUserId = 0;
    for ($attempt = 0; $attempt < 6; $attempt++) {
        if ($effectiveVoterId === null) {
            $effectiveVoterId = generate_unique_voter_id($pdo);
        }

        try {
            $stmt->execute([
                'full_name' => $fullName,
                'email' => $email,
                'phone' => $phone,
                'voter_id' => $effectiveVoterId,
                'password_hash' => password_hash($password, PASSWORD_BCRYPT),
                'role' => USER_ROLE_VOTER,
                'status' => USER_STATUS_ACTIVE,
                'is_verified' => 1,
            ]);
            $voterUserId = (int) $pdo->lastInsertId();
            break;
        } catch (Throwable $insertError) {
            if ($voterId === null && $attempt < 5 && is_voter_id_unique_constraint($insertError)) {
                $effectiveVoterId = null;
                continue;
            }
            throw $insertError;
        }
    }

    if ($voterUserId <= 0 || $effectiveVoterId === null) {
        throw new RuntimeException('Unable to create voter account');
    }

    audit_log('admin.add_voter', (int) $admin['id'], ['voter_user_id' => $voterUserId]);

    json_success([
        'voter_user_id' => $voterUserId,
        'voter_id' => $effectiveVoterId,
    ], 'Voter added successfully', 201);
} catch (Throwable $e) {
    app_log('error', 'Add voter failed', ['error' => $e->getMessage(), 'admin_id' => (int) $admin['id']]);
    json_error('Unable to add voter', 500);
}
