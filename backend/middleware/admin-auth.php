<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

function require_admin_auth(): array
{
    $user = require_auth();
    if (($user['role'] ?? '') !== USER_ROLE_ADMIN) {
        json_error('Admin access required', 403);
    }

    return $user;
}
