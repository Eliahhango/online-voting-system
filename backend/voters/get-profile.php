<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/voter-auth.php';

require_method('GET');

$user = require_voter_auth();

json_success([
    'profile' => [
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
