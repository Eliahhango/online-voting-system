<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/voter-auth.php';
require_once __DIR__ . '/../helpers/sanitizer.php';
require_once __DIR__ . '/../helpers/validator.php';

require_method(['POST', 'PUT', 'PATCH']);

$user = require_voter_auth();
$input = get_json_input();

if (array_key_exists('voter_id', $input)) {
    json_error('Voter ID cannot be changed by registrant', 403, [
        'voter_id' => 'Voter ID is system-generated and immutable',
    ]);
}

$fullName = sanitize_nullable_string($input['full_name'] ?? null, 120);
$email = array_key_exists('email', $input) ? sanitize_email($input['email']) : null;
$phone = sanitize_nullable_string($input['phone'] ?? null, 30);

if ($fullName === null && $email === null && !array_key_exists('phone', $input)) {
    json_error('No profile fields provided for update', 422);
}

$errors = [];
if ($email !== null) {
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

    if ($email !== null) {
        $existsStmt = $pdo->prepare('SELECT id FROM users WHERE email = :email AND id != :id LIMIT 1');
        $existsStmt->execute([
            'email' => $email,
            'id' => (int) $user['id'],
        ]);
        if ($existsStmt->fetch()) {
            json_error('Email is already in use', 409);
        }
    }

    $fields = [];
    $params = ['id' => (int) $user['id']];

    if ($fullName !== null) {
        $fields[] = 'full_name = :full_name';
        $params['full_name'] = $fullName;
    }

    if ($email !== null) {
        $fields[] = 'email = :email';
        $params['email'] = $email;
    }

    if (array_key_exists('phone', $input)) {
        $fields[] = 'phone = :phone';
        $params['phone'] = $phone;
    }

    $fields[] = 'updated_at = CURRENT_TIMESTAMP';

    $sql = 'UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = :id';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    audit_log('voter.update_profile', (int) $user['id']);

    $refetch = $pdo->prepare('SELECT id, full_name, email, phone, voter_id, role, status, is_verified, created_at FROM users WHERE id = :id LIMIT 1');
    $refetch->execute(['id' => (int) $user['id']]);
    $updated = $refetch->fetch();

    json_success(['profile' => $updated], 'Profile updated successfully');
} catch (Throwable $e) {
    app_log('error', 'Update profile failed', ['error' => $e->getMessage(), 'user_id' => (int) $user['id']]);
    json_error('Unable to update profile', 500);
}
