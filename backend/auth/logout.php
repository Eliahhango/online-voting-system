<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/auth.php';

require_method(['POST', 'GET']);

$user = current_user();
if ($user) {
    audit_log('auth.logout', (int) $user['id']);
}

logout_user();

json_success([], 'Logged out successfully');
