<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/admin-auth.php';

require_method('GET');

require_admin_auth();

$electionId = int_param('election_id');
$positionId = int_param('position_id');
$search = trim((string) query_param('search', ''));
[$page, $limit, $offset] = paginate_clause();

try {
    $pdo = db();

    $where = [];
    $params = [];

    if ($electionId) {
        $where[] = 'c.election_id = :election_id';
        $params['election_id'] = $electionId;
    }

    if ($positionId) {
        $where[] = 'c.position_id = :position_id';
        $params['position_id'] = $positionId;
    }

    if ($search !== '') {
        $where[] = '(c.full_name LIKE :search OR c.party LIKE :search OR c.bio LIKE :search)';
        $params['search'] = '%' . $search . '%';
    }

    $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM candidates c $whereSql");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    $sql =
        "SELECT
            c.id,
            c.election_id,
            e.title AS election_title,
            c.position_id,
            p.title AS position_title,
            c.full_name,
            c.party,
            c.bio,
            c.photo_path,
            c.manifesto,
            c.status,
            c.created_at
         FROM candidates c
         INNER JOIN elections e ON e.id = c.election_id
         INNER JOIN positions p ON p.id = c.position_id AND p.election_id = c.election_id
         $whereSql
         ORDER BY c.created_at DESC
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
    app_log('error', 'List candidates failed', ['error' => $e->getMessage()]);
    json_error('Unable to list candidates', 500);
}
