<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../helpers/sanitizer.php';
require_once __DIR__ . '/../helpers/validator.php';

require_method('POST');

$input = get_json_input();
$identifier = sanitize_string($input['identifier'] ?? '', 150);
$email = sanitize_email($input['email'] ?? '');
$voterId = sanitize_nullable_string($input['voter_id'] ?? '', 80);
$password = (string) ($input['password'] ?? '');
$expectedRole = strtolower(trim((string) ($input['expected_role'] ?? '')));

if ($identifier !== '') {
    if (strpos($identifier, '@') !== false) {
        $email = sanitize_email($identifier);
    } else {
        $voterId = sanitize_string($identifier, 80);
    }
}

$errors = [];
if ($password === '') {
    $errors['password'] = 'Password is required';
}

if ($email === '' && ($voterId === null || $voterId === '')) {
    $errors['identifier'] = 'Email or voter ID is required';
}

if ($email !== '') {
    $emailError = validate_email_format($email);
    if ($emailError !== null) {
        $errors['email'] = $emailError;
    }
}

if ($expectedRole === '') {
    $errors['expected_role'] = 'expected_role is required';
} elseif (!in_array($expectedRole, [USER_ROLE_ADMIN, USER_ROLE_VOTER], true)) {
    $errors['expected_role'] = 'expected_role must be admin or voter';
}

if (!empty($errors)) {
    json_error('Validation failed', 422, $errors);
}

try {
    $sql = 'SELECT id, full_name, email, phone, voter_id, password_hash, role, status, is_verified FROM users WHERE ';
    $params = [];

    if ($email !== '') {
        $sql .= 'email = :email';
        $params['email'] = $email;
    } else {
        $sql .= 'voter_id = :voter_id';
        $params['voter_id'] = $voterId;
    }
    $sql .= ' LIMIT 1';

    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, (string) $user['password_hash'])) {
        json_error('Invalid credentials', 401);
    }

    if (($user['status'] ?? '') !== USER_STATUS_ACTIVE) {
        json_error('Account is not active', 403);
    }

    if ((string) ($user['role'] ?? '') !== $expectedRole) {
        json_error('This account is not allowed in the selected portal', 403, [
            'expected_role' => 'Use the correct login portal for this account role',
        ]);
    }

    login_user($user);
    audit_log('auth.login', (int) $user['id']);

    json_success([
        'user' => [
            'id' => (int) $user['id'],
            'full_name' => $user['full_name'],
            'email' => $user['email'],
            'phone' => $user['phone'],
            'voter_id' => $user['voter_id'],
            'role' => $user['role'],
            'is_verified' => (bool) $user['is_verified'],
        ],
        'session_id' => session_id(),
    ], 'Login successful');
} catch (Throwable $e) {
    app_log('error', 'Login failed', ['error' => $e->getMessage()]);
    json_error('Unable to login at this time', 500);
}
