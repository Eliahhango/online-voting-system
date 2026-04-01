<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/auth.php';

require_method('GET');

$user = current_user();

if (!$user) {
    json_success([
        'authenticated' => false,
        'user' => null,
    ]);
}

json_success([
    'authenticated' => true,
    'user' => [
        'id' => (int) $user['id'],
        'full_name' => $user['full_name'],
        'email' => $user['email'],
        'phone' => $user['phone'],
        'voter_id' => $user['voter_id'],
        'role' => $user['role'],
        'status' => $user['status'],
        'is_verified' => (bool) $user['is_verified'],
        'created_at' => $user['created_at'],
    ],
]);
