<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/constants.php';

function send_json(array $payload, int $statusCode = 200, array $headers = []): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');

    foreach ($headers as $name => $value) {
        header($name . ': ' . $value);
    }

    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_success(array $data = [], string $message = 'OK', int $statusCode = 200): void
{
    send_json([
        'success' => true,
        'message' => $message,
        'data' => $data,
    ], $statusCode);
}

function json_error(string $message, int $statusCode = 400, array $errors = [], array $extra = []): void
{
    send_json([
        'success' => false,
        'message' => $message,
        'errors' => $errors,
        'meta' => $extra,
    ], $statusCode);
}

function request_method(): string
{
    return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
}

function require_method($allowed): void
{
    $methods = is_array($allowed) ? array_map('strtoupper', $allowed) : [strtoupper((string) $allowed)];
    if (!in_array(request_method(), $methods, true)) {
        json_error('Method not allowed', 405, [], ['allowed' => $methods]);
    }
}

function get_json_input(): array
{
    $contentType = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));
    $raw = file_get_contents('php://input');

    if (strpos($contentType, 'application/json') !== false) {
        $decoded = json_decode((string) $raw, true);
        if (!is_array($decoded)) {
            return [];
        }

        return $decoded;
    }

    if (!empty($_POST)) {
        return $_POST;
    }

    $decoded = json_decode((string) $raw, true);
    return is_array($decoded) ? $decoded : [];
}

function query_param(string $key, $default = null)
{
    return $_GET[$key] ?? $default;
}

function body_param(array $input, string $key, $default = null)
{
    return $input[$key] ?? $default;
}

function int_param(string $key, ?int $default = null): ?int
{
    if (!isset($_GET[$key])) {
        return $default;
    }

    $value = filter_var($_GET[$key], FILTER_VALIDATE_INT);
    return $value === false ? $default : (int) $value;
}

function paginate_clause(): array
{
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $limit = (int) ($_GET['limit'] ?? DEFAULT_PAGINATION_LIMIT);
    $limit = max(1, min(MAX_PAGINATION_LIMIT, $limit));
    $offset = ($page - 1) * $limit;

    return [$page, $limit, $offset];
}
