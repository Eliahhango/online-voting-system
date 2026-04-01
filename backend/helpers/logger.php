<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/db.php';

function app_log(string $level, string $message, array $context = []): void
{
    $cfg = app_config();
    $logFile = $cfg['log_file'];
    $dir = dirname($logFile);
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }

    $entry = [
        'timestamp' => date('c'),
        'level' => strtoupper($level),
        'message' => $message,
        'context' => $context,
    ];

    file_put_contents($logFile, json_encode($entry, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL, FILE_APPEND);
}

function audit_log(string $action, ?int $userId = null, array $meta = []): void
{
    app_log('audit', $action, [
        'user_id' => $userId,
        'meta' => $meta,
        'ip' => $_SERVER['REMOTE_ADDR'] ?? null,
    ]);

    try {
        $stmt = db()->prepare(
            'INSERT INTO audit_logs (user_id, action, meta_json, ip_address, created_at)
             VALUES (:user_id, :action, :meta_json, :ip_address, CURRENT_TIMESTAMP)'
        );

        $stmt->execute([
            'user_id' => $userId,
            'action' => $action,
            'meta_json' => json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
        ]);
    } catch (Throwable $e) {
        app_log('warning', 'Failed to persist audit log', [
            'action' => $action,
            'error' => $e->getMessage(),
        ]);
    }
}
