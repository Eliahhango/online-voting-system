<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/config.php';

function resolve_cors_origin(array $cfg): string
{
    $configured = trim((string) ($cfg['cors_allow_origin'] ?? '*'));
    $requestOrigin = trim((string) ($_SERVER['HTTP_ORIGIN'] ?? ''));

    if ($configured === '*') {
        // For credentialed requests, echo the caller origin instead of wildcard.
        return $requestOrigin !== '' ? $requestOrigin : '*';
    }

    $allowedOrigins = array_values(array_filter(array_map('trim', explode(',', $configured)), static function (string $value): bool {
        return $value !== '';
    }));

    if ($requestOrigin !== '' && in_array($requestOrigin, $allowedOrigins, true)) {
        return $requestOrigin;
    }

    return $allowedOrigins[0] ?? '';
}

function apply_cors_headers(): void
{
    $cfg = app_config();
    $origin = resolve_cors_origin($cfg);

    if ($origin !== '') {
        header('Access-Control-Allow-Origin: ' . $origin);
    }
    if (isset($_SERVER['HTTP_ORIGIN'])) {
        header('Vary: Origin');
    }
    header('Access-Control-Allow-Methods: ' . $cfg['cors_allow_methods']);
    header('Access-Control-Allow-Headers: ' . $cfg['cors_allow_headers']);
    header('Access-Control-Max-Age: 600');

    if ($origin !== '*') {
        header('Access-Control-Allow-Credentials: true');
    }
}

apply_cors_headers();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}
