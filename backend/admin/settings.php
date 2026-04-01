<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/admin-auth.php';
require_once __DIR__ . '/../helpers/sanitizer.php';

require_method(['GET', 'POST', 'PUT']);

$admin = require_admin_auth();
$pdo = db();

try {
    if (request_method() === 'GET') {
        $stmt = $pdo->query('SELECT key, value, namespace, updated_at FROM settings ORDER BY namespace ASC, key ASC');
        $rows = $stmt->fetchAll();

        $grouped = [];
        foreach ($rows as $row) {
            $ns = (string) $row['namespace'];
            if (!isset($grouped[$ns])) {
                $grouped[$ns] = [];
            }
            $grouped[$ns][] = $row;
        }

        json_success(['items' => $rows, 'by_namespace' => $grouped]);
    }

    $input = get_json_input();
    $settingsInput = $input['settings'] ?? null;

    $items = [];
    if (is_array($settingsInput) && array_keys($settingsInput) === range(0, count($settingsInput) - 1)) {
        foreach ($settingsInput as $item) {
            if (!is_array($item)) {
                continue;
            }
            $key = sanitize_string($item['key'] ?? '', 120);
            $value = isset($item['value']) ? (string) $item['value'] : '';
            $namespace = sanitize_string($item['namespace'] ?? SETTINGS_NAMESPACE_GENERAL, 60);
            if ($key !== '') {
                $items[] = ['key' => $key, 'value' => $value, 'namespace' => $namespace];
            }
        }
    } else {
        $key = sanitize_string($input['key'] ?? '', 120);
        $value = isset($input['value']) ? (string) $input['value'] : '';
        $namespace = sanitize_string($input['namespace'] ?? SETTINGS_NAMESPACE_GENERAL, 60);
        if ($key !== '') {
            $items[] = ['key' => $key, 'value' => $value, 'namespace' => $namespace];
        }
    }

    if (empty($items)) {
        json_error('No valid settings provided', 422);
    }

    $pdo->beginTransaction();

    $stmt = $pdo->prepare(
        'INSERT INTO settings (key, value, namespace, updated_at)
         VALUES (:key, :value, :namespace, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            namespace = excluded.namespace,
            updated_at = CURRENT_TIMESTAMP'
    );

    foreach ($items as $item) {
        $stmt->execute([
            'key' => $item['key'],
            'value' => $item['value'],
            'namespace' => $item['namespace'],
        ]);
    }

    $pdo->commit();

    audit_log('admin.update_settings', (int) $admin['id'], ['count' => count($items)]);

    json_success(['updated' => count($items)], 'Settings saved successfully');
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    app_log('error', 'Settings endpoint failed', ['error' => $e->getMessage(), 'admin_id' => (int) $admin['id']]);
    json_error('Unable to process settings request', 500);
}
