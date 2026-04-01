<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/admin-auth.php';

require_method('GET');

require_admin_auth();

$electionId = int_param('election_id');

try {
    $pdo = db();

    $sql =
        "SELECT
            p.id,
            p.election_id,
            e.title AS election_title,
            p.parent_position_id,
            pp.title AS parent_position_title,
            p.title,
            p.description,
            p.seat_count,
            p.sort_order,
            p.created_at,
            (SELECT COUNT(*) FROM candidates c WHERE c.position_id = p.id AND c.election_id = p.election_id AND c.status = 'active') AS candidates_count
         FROM positions p
         INNER JOIN elections e ON e.id = p.election_id
         LEFT JOIN positions pp ON pp.id = p.parent_position_id AND pp.election_id = p.election_id";

    $params = [];
    if ($electionId) {
        $sql .= ' WHERE p.election_id = :election_id';
        $params['election_id'] = $electionId;
    }

    $sql .= ' ORDER BY p.election_id DESC, COALESCE(p.parent_position_id, 0) ASC, p.sort_order ASC, p.id ASC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    json_success(['items' => $stmt->fetchAll()]);
} catch (Throwable $e) {
    app_log('error', 'List positions failed', ['error' => $e->getMessage()]);
    json_error('Unable to list positions', 500);
}
