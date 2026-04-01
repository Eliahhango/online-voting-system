<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/admin-auth.php';

require_method('GET');

$admin = require_admin_auth();

try {
    $pdo = db();

    $totalVoters = (int) $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'voter'")->fetchColumn();
    $activeVoters = (int) $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'voter' AND status = 'active'")->fetchColumn();
    $activeElections = (int) $pdo->query("SELECT COUNT(*) FROM elections WHERE status = 'published' AND CURRENT_TIMESTAMP BETWEEN start_at AND end_at")->fetchColumn();
    $totalBallots = (int) $pdo->query('SELECT COUNT(*) FROM ballots')->fetchColumn();

    $flaggedAccounts = (int) $pdo->query("SELECT COUNT(*) FROM users WHERE status = 'suspended'")->fetchColumn();

    $recentElectionsStmt = $pdo->query(
        "SELECT
            e.id,
            e.title,
            e.status,
            e.start_at,
            e.end_at,
            (SELECT COUNT(*) FROM ballots b WHERE b.election_id = e.id) AS ballots_cast,
            (SELECT COUNT(*) FROM positions p WHERE p.election_id = e.id) AS positions_count
         FROM elections e
         ORDER BY e.created_at DESC
         LIMIT 6"
    );
    $recentElections = $recentElectionsStmt->fetchAll();

    $activityStmt = $pdo->query(
        "SELECT id, user_id, action, meta_json, ip_address, created_at
         FROM audit_logs
         ORDER BY created_at DESC
         LIMIT 12"
    );
    $activity = $activityStmt->fetchAll();

    json_success([
        'stats' => [
            'total_voters' => $totalVoters,
            'active_voters' => $activeVoters,
            'active_elections' => $activeElections,
            'total_ballots' => $totalBallots,
            'security_flags' => $flaggedAccounts,
        ],
        'recent_elections' => $recentElections,
        'recent_activity' => $activity,
        'generated_at' => date('c'),
    ]);
} catch (Throwable $e) {
    app_log('error', 'Admin dashboard stats failed', ['error' => $e->getMessage(), 'admin_id' => (int) $admin['id']]);
    json_error('Unable to fetch dashboard stats', 500);
}
