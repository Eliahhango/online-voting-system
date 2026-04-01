<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/admin-auth.php';

require_method('GET');

require_admin_auth();

$status = strtolower(trim((string) query_param('status', '')));
$search = trim((string) query_param('search', ''));
[$page, $limit, $offset] = paginate_clause();

$allowedStatus = ['', 'draft', 'published', 'closed'];
if (!in_array($status, $allowedStatus, true)) {
    json_error('Invalid status filter', 422, ['status' => 'Allowed values: draft, published, closed']);
}

try {
    $pdo = db();

    $where = [];
    $params = [];

    if ($status !== '') {
        $where[] = 'e.status = :status';
        $params['status'] = $status;
    }

    if ($search !== '') {
        $where[] = '(e.title LIKE :search OR e.description LIKE :search)';
        $params['search'] = '%' . $search . '%';
    }

    $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM elections e $whereSql");
    $countStmt->execute($params);
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
            e.created_at,
            e.updated_at,
            (SELECT COUNT(*) FROM positions p WHERE p.election_id = e.id) AS positions_count,
            (SELECT COUNT(*) FROM candidates c WHERE c.election_id = e.id) AS candidates_count,
            (SELECT COUNT(*) FROM ballots b WHERE b.election_id = e.id) AS ballots_cast
         FROM elections e
         $whereSql
         ORDER BY e.created_at DESC
         LIMIT :limit OFFSET :offset";

    $stmt = $pdo->prepare($sql);
    foreach ($params as $k => $v) {
        $stmt->bindValue(':' . $k, $v);
    }
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();

    json_success([
        'items' => $stmt->fetchAll(),
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'total_pages' => $limit > 0 ? (int) ceil($total / $limit) : 1,
        ],
    ]);
} catch (Throwable $e) {
    app_log('error', 'List elections failed', ['error' => $e->getMessage()]);
    json_error('Unable to list elections', 500);
}
