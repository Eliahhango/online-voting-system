<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

function request_base_path(): string
{
    $path = (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    $pos = strpos($path, '/frontend/');
    if ($pos === false) {
        return '';
    }

    return substr($path, 0, $pos);
}

function redirect_to(string $url): void
{
    header('Location: ' . $url, true, 302);
    exit;
}

$scope = strtolower(trim((string) ($_GET['scope'] ?? '')));
$page = trim((string) ($_GET['page'] ?? ''));

if (!in_array($scope, [USER_ROLE_ADMIN, USER_ROLE_VOTER], true)) {
    http_response_code(400);
    echo 'Invalid scope';
    exit;
}

if (!preg_match('/^[a-z0-9\-]+$/i', $page)) {
    http_response_code(400);
    echo 'Invalid page';
    exit;
}

$basePath = request_base_path();
$requestUri = (string) ($_SERVER['REQUEST_URI'] ?? '/');

$user = current_user();
if (!$user) {
    $loginUrl = $basePath . '/frontend/login.html?portal=' . rawurlencode($scope) . '&next=' . rawurlencode($requestUri);
    redirect_to($loginUrl);
}

$role = (string) ($user['role'] ?? '');
if ($role !== $scope) {
    $dash = $basePath . '/frontend/' . ($role === USER_ROLE_ADMIN ? 'admin/dashboard.html' : 'voter/dashboard.html');
    redirect_to($dash);
}

$targetFile = app_root() . DIRECTORY_SEPARATOR . 'frontend' . DIRECTORY_SEPARATOR . $scope . DIRECTORY_SEPARATOR . $page . '.html';
if (!is_file($targetFile)) {
    http_response_code(404);
    echo 'Page not found';
    exit;
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

readfile($targetFile);
exit;
