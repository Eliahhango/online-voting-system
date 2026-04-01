<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/cors.php';
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/logger.php';

require_method('GET');

$statusFilter = strtolower(trim((string) query_param('status', 'upcoming')));
[$page, $limit, $offset] = paginate_clause();

$allowed = ['active', 'upcoming', 'closed', 'all', ''];
if (!in_array($statusFilter, $allowed, true)) {
    json_error('Invalid status filter', 422, ['status' => 'Allowed values: active, upcoming, closed, all']);
}

try {
    $pdo = db();

    $nowExpr = "julianday('now')";
    $startExpr = "julianday(replace(replace(e.start_at, 'T', ' '), 'Z', ''))";
    $endExpr = "julianday(replace(replace(e.end_at, 'T', ' '), 'Z', ''))";

    $where = "WHERE e.visibility = 'public' AND e.status IN ('published', 'closed')";
    if ($statusFilter === 'active') {
        $where .= " AND e.status = 'published'
            AND $startExpr IS NOT NULL
            AND $endExpr IS NOT NULL
            AND $nowExpr >= $startExpr
            AND $nowExpr <= $endExpr";
    } elseif ($statusFilter === 'upcoming') {
        $where .= " AND e.status = 'published'
            AND $startExpr IS NOT NULL
            AND $nowExpr < $startExpr";
    } elseif ($statusFilter === 'closed') {
        $where .= " AND (e.status = 'closed' OR ($endExpr IS NOT NULL AND $nowExpr > $endExpr))";
    }

    $countStmt = $pdo->query("SELECT COUNT(*) AS total FROM elections e $where");
    $total = (int) $countStmt->fetchColumn();

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
                WHEN $startExpr IS NULL OR $endExpr IS NULL THEN 'closed'
                WHEN $nowExpr < $startExpr THEN 'upcoming'
                WHEN $nowExpr > $endExpr THEN 'closed'
                ELSE 'active'
            END AS phase,
            (SELECT COUNT(*) FROM positions p WHERE p.election_id = e.id) AS positions_count,
            (SELECT COUNT(*) FROM candidates c WHERE c.election_id = e.id AND c.status = 'active') AS candidates_count,
            (SELECT COALESCE(SUM(p2.seat_count), 0) FROM positions p2 WHERE p2.election_id = e.id) AS seats_total,
            (SELECT COUNT(*) FROM ballots b WHERE b.election_id = e.id) AS ballots_cast
         FROM elections e
         $where
         ORDER BY e.start_at ASC
         LIMIT :limit OFFSET :offset";

    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $rows = $stmt->fetchAll();

    json_success([
        'items' => $rows,
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'total_pages' => $limit > 0 ? (int) ceil($total / $limit) : 1,
        ],
    ]);
} catch (Throwable $e) {
    app_log('error', 'Get public elections failed', ['error' => $e->getMessage()]);
    json_error('Unable to fetch elections', 500);
}
