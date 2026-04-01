<?php
declare(strict_types=1);

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/logger.php';

ensure_session_started();

function current_user(): ?array
{
    if (!isset($_SESSION['user_id'])) {
        return null;
    }

    $stmt = db()->prepare('SELECT id, full_name, email, phone, voter_id, role, status, is_verified, created_at FROM users WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => (int) $_SESSION['user_id']]);
    $user = $stmt->fetch();

    if (!$user) {
        return null;
    }

    return $user;
}

function login_user(array $user): void
{
    ensure_session_started();
    session_regenerate_id(true);

    $_SESSION['user_id'] = (int) $user['id'];
    $_SESSION['user_role'] = (string) $user['role'];
    $_SESSION['logged_in_at'] = date('c');
}

function logout_user(): void
{
    ensure_session_started();
    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'] ?? '', (bool) $params['secure'], (bool) $params['httponly']);
    }

    session_destroy();
}

function require_auth(): array
{
    $user = current_user();

    if (!$user) {
        json_error('Authentication required', 401);
    }

    if (($user['status'] ?? '') !== USER_STATUS_ACTIVE) {
        json_error('Account is not active', 403);
    }

    return $user;
}

function require_same_origin_request(): void
{
    $host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
    if ($host === '') {
        return;
    }

    $origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    $referer = (string) ($_SERVER['HTTP_REFERER'] ?? '');

    $extractHost = static function (string $url): string {
        if ($url === '') {
            return '';
        }
        $parts = parse_url($url);
        if (!is_array($parts)) {
            return '';
        }
        $h = strtolower((string) ($parts['host'] ?? ''));
        $port = isset($parts['port']) ? (string) $parts['port'] : '';
        if ($h === '') {
            return '';
        }
        return $port !== '' ? ($h . ':' . $port) : $h;
    };

    $originHost = $extractHost($origin);
    $refererHost = $extractHost($referer);

    if ($originHost !== '' && $originHost !== $host) {
        json_error('Cross-origin request blocked', 403);
    }
    if ($originHost === '' && $refererHost !== '' && $refererHost !== $host) {
        json_error('Cross-origin request blocked', 403);
    }
}
