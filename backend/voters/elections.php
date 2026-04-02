<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/voter-auth.php';

require_method('GET');

$user = require_voter_auth();
$statusFilter = strtolower(trim((string) query_param('status', '')));

$allowed = ['active', 'upcoming', 'closed', 'all', ''];
if (!in_array($statusFilter, $allowed, true)) {
    json_error('Invalid status filter', 422, ['status' => 'Allowed values: active, upcoming, closed, all']);
}

try {
    $pdo = db();

    $where = "WHERE e.status IN ('published', 'closed')";
    if ($statusFilter === 'active') {
        $where .= " AND e.status = 'published' AND CURRENT_TIMESTAMP >= e.start_at AND CURRENT_TIMESTAMP <= e.end_at";
    } elseif ($statusFilter === 'upcoming') {
        $where .= " AND e.status = 'published' AND CURRENT_TIMESTAMP < e.start_at";
    } elseif ($statusFilter === 'closed') {
        $where .= " AND (e.status = 'closed' OR CURRENT_TIMESTAMP > e.end_at)";
    }

    $sql =
        "SELECT
            e.id,
            e.title,
            e.description,
            e.start_at,
            e.end_at,
            e.status,
            e.visibility,
            CASE
                WHEN e.status = 'closed' THEN 'closed'
                WHEN CURRENT_TIMESTAMP < e.start_at THEN 'upcoming'
                WHEN CURRENT_TIMESTAMP > e.end_at THEN 'closed'
                ELSE 'active'
            END AS phase,
            (SELECT COUNT(*) FROM positions p WHERE p.election_id = e.id) AS positions_count,
            (SELECT COUNT(*) FROM candidates c WHERE c.election_id = e.id AND c.status = 'active') AS candidates_count,
            EXISTS(
                SELECT 1 FROM ballots b2
                WHERE b2.election_id = e.id
                  AND b2.voter_id = :voter_id
            ) AS has_voted
         FROM elections e
         $where
         ORDER BY e.start_at DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(':voter_id', (int) $user['id'], PDO::PARAM_INT);
    $stmt->execute();
    $rows = $stmt->fetchAll();

    // Legacy shape: return list directly in data for older clients/tests.
    json_success($rows);
} catch (Throwable $e) {
    app_log('error', 'Legacy elections endpoint failed', ['error' => $e->getMessage(), 'user_id' => (int) $user['id']]);
    json_error('Unable to fetch elections', 500);
}
