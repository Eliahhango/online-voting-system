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
    $pdo = connect_mysql($cfg);

    initialize_mysql_if_needed($pdo);

    return $pdo;
}

function initialize_mysql_if_needed(PDO $pdo): void
{
    if (mysql_table_exists($pdo, 'users')) {
        return;
    }

    $schemaPath = app_root() . DIRECTORY_SEPARATOR . 'database' . DIRECTORY_SEPARATOR . 'schema-mysql.sql';
    $seedPath = app_root() . DIRECTORY_SEPARATOR . 'database' . DIRECTORY_SEPARATOR . 'seed-mysql.sql';

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

function connect_mysql(array $cfg): PDO
{
    try {
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=%s',
            $cfg['db_host'],
            $cfg['db_port'],
            $cfg['db_name'],
            $cfg['db_charset']
        );

        return new PDO($dsn, $cfg['db_user'], $cfg['db_pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException $e) {
        if ((int) $e->getCode() !== 1049) {
            throw $e;
        }

        $serverDsn = sprintf(
            'mysql:host=%s;port=%s;charset=%s',
            $cfg['db_host'],
            $cfg['db_port'],
            $cfg['db_charset']
        );

        $serverPdo = new PDO($serverDsn, $cfg['db_user'], $cfg['db_pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);

        $databaseName = trim((string) $cfg['db_name']);
        if ($databaseName === '' || !preg_match('/^[A-Za-z0-9_]+$/', $databaseName)) {
            throw new RuntimeException('Invalid MySQL database name');
        }

        $serverPdo->exec(sprintf(
            'CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET %s COLLATE utf8mb4_unicode_ci',
            str_replace('`', '``', $databaseName),
            $cfg['db_charset']
        ));

        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=%s',
            $cfg['db_host'],
            $cfg['db_port'],
            $databaseName,
            $cfg['db_charset']
        );

        return new PDO($dsn, $cfg['db_user'], $cfg['db_pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
}

function mysql_table_exists(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :name'
    );
    $stmt->execute(['name' => $table]);

    return (int) $stmt->fetchColumn() > 0;
}