<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

function require_voter_auth(): array
{
    $user = require_auth();
    if (($user['role'] ?? '') !== USER_ROLE_VOTER) {
        json_error('Voter access required', 403);
    }

    return $user;
}
