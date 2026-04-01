<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $cfg = app_config();
    $driver = strtolower((string) $cfg['db_driver']);

    if ($driver === 'mysql') {
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=%s',
            $cfg['db_host'],
            $cfg['db_port'],
            $cfg['db_name'],
            $cfg['db_charset']
        );

        $pdo = new PDO($dsn, $cfg['db_user'], $cfg['db_pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);

        return $pdo;
    }

    $dbPath = (string) $cfg['db_path'];
    $dbDir = dirname($dbPath);
    if (!is_dir($dbDir)) {
        mkdir($dbDir, 0777, true);
    }

    $pdo = new PDO('sqlite:' . $dbPath, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    $pdo->exec('PRAGMA foreign_keys = ON');

    initialize_sqlite_if_needed($pdo);
    ensure_sqlite_schema_migrations($pdo);

    return $pdo;
}

function initialize_sqlite_if_needed(PDO $pdo): void
{
    if (sqlite_table_exists($pdo, 'users')) {
        return;
    }

    $schemaPath = app_root() . DIRECTORY_SEPARATOR . 'database' . DIRECTORY_SEPARATOR . 'schema.sql';
    $seedPath = app_root() . DIRECTORY_SEPARATOR . 'database' . DIRECTORY_SEPARATOR . 'seed.sql';

    if (is_file($schemaPath)) {
        $schemaSql = file_get_contents($schemaPath);
        if ($schemaSql !== false && trim($schemaSql) !== '') {
            $pdo->exec($schemaSql);
        }
    }

    if (is_file($seedPath)) {
        $seedSql = file_get_contents($seedPath);
        if ($seedSql !== false && trim($seedSql) !== '') {
            $pdo->exec($seedSql);
        }
    }
}

function sqlite_table_exists(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = :name");
    $stmt->execute(['name' => $table]);

    return (bool) $stmt->fetchColumn();
}

function sqlite_column_exists(PDO $pdo, string $table, string $column): bool
{
    $stmt = $pdo->query('PRAGMA table_info(' . $table . ')');
    $rows = $stmt ? $stmt->fetchAll() : [];
    foreach ($rows as $row) {
        if (isset($row['name']) && strcasecmp((string) $row['name'], $column) === 0) {
            return true;
        }
    }

    return false;
}

function ensure_sqlite_schema_migrations(PDO $pdo): void
{
    if (!sqlite_table_exists($pdo, 'positions')) {
        return;
    }

    if (!sqlite_column_exists($pdo, 'positions', 'parent_position_id')) {
        $pdo->exec('ALTER TABLE positions ADD COLUMN parent_position_id INTEGER');
    }

    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_positions_parent_position_id ON positions(parent_position_id)');
}
