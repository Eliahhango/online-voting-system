<?php
declare(strict_types=1);

require_once __DIR__ . '/constants.php';

function env_value(string $key, ?string $default = null): ?string
{
    $value = getenv($key);
    if ($value === false || $value === '') {
        return $default;
    }

    return $value;
}

function app_root(): string
{
    return dirname(__DIR__, 2);
}

function app_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }

    $root = app_root();

    $config = [
        'app_env' => env_value('APP_ENV', 'development'),
        'app_name' => env_value('APP_NAME', 'Online Voting System'),
        'app_timezone' => env_value('APP_TIMEZONE', 'UTC'),
        'session_name' => env_value('SESSION_NAME', 'ovs_session'),
        'session_secure' => env_value('SESSION_SECURE', 'auto'),
        'session_samesite' => env_value('SESSION_SAMESITE', 'Lax'),

        'db_driver' => env_value('DB_DRIVER', 'sqlite'),
        'db_host' => env_value('DB_HOST', '127.0.0.1'),
        'db_port' => env_value('DB_PORT', '3306'),
        'db_name' => env_value('DB_NAME', 'online_voting_system'),
        'db_user' => env_value('DB_USER', 'root'),
        'db_pass' => env_value('DB_PASS', ''),
        'db_charset' => env_value('DB_CHARSET', 'utf8mb4'),
        'db_path' => env_value('DB_PATH', $root . DIRECTORY_SEPARATOR . 'database' . DIRECTORY_SEPARATOR . 'app.sqlite'),

        'cors_allow_origin' => env_value('CORS_ALLOW_ORIGIN', '*'),
        'cors_allow_methods' => env_value('CORS_ALLOW_METHODS', 'GET, POST, PUT, PATCH, DELETE, OPTIONS'),
        'cors_allow_headers' => env_value('CORS_ALLOW_HEADERS', 'Content-Type, Authorization, X-Requested-With'),

        'log_file' => env_value('APP_LOG_FILE', $root . DIRECTORY_SEPARATOR . 'backend' . DIRECTORY_SEPARATOR . 'logs' . DIRECTORY_SEPARATOR . 'app.log'),
        'candidate_upload_dir' => env_value('CANDIDATE_UPLOAD_DIR', $root . DIRECTORY_SEPARATOR . 'backend' . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'candidates'),
        'user_upload_dir' => env_value('USER_UPLOAD_DIR', $root . DIRECTORY_SEPARATOR . 'backend' . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'users'),
    ];

    date_default_timezone_set($config['app_timezone']);

    return $config;
}

function is_production(): bool
{
    return app_config()['app_env'] === 'production';
}

function ensure_session_started(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $cfg = app_config();
    $secureCfg = strtolower((string) ($cfg['session_secure'] ?? 'auto'));
    if (in_array($secureCfg, ['1', 'true', 'yes'], true)) {
        $secure = true;
    } elseif (in_array($secureCfg, ['0', 'false', 'no'], true)) {
        $secure = false;
    } else {
        $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    }

    $sameSite = ucfirst(strtolower((string) ($cfg['session_samesite'] ?? 'Lax')));
    if (!in_array($sameSite, ['Lax', 'Strict', 'None'], true)) {
        $sameSite = 'Lax';
    }
    if ($sameSite === 'None') {
        $secure = true; // Required by modern browsers for SameSite=None.
    }

    session_name($cfg['session_name']);
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => $sameSite,
    ]);

    session_start();
}
