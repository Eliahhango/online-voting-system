<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/admin-auth.php';

require_method('GET');

require_admin_auth();

$status = strtolower(trim((string) query_param('status', '')));
$search = trim((string) query_param('search', ''));
[$page, $limit, $offset] = paginate_clause();

$allowedStatus = ['', USER_STATUS_ACTIVE, USER_STATUS_INACTIVE, USER_STATUS_SUSPENDED];
if (!in_array($status, $allowedStatus, true)) {
    json_error('Invalid status filter', 422, ['status' => 'Allowed values: active, inactive, suspended']);
}

try {
    $pdo = db();

    $where = ["u.role = 'voter'"];
    $params = [];

    if ($status !== '') {
        $where[] = 'u.status = :status';
        $params['status'] = $status;
    }

    if ($search !== '') {
        $where[] = '(u.full_name LIKE :search OR u.email LIKE :search OR u.voter_id LIKE :search)';
        $params['search'] = '%' . $search . '%';
    }

    $whereSql = 'WHERE ' . implode(' AND ', $where);

    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM users u $whereSql");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    $sql =
        "SELECT
            u.id,
            u.full_name,
            u.email,
            u.phone,
            u.voter_id,
            u.status,
            u.is_verified,
            u.created_at,
            (SELECT COUNT(*) FROM ballots b WHERE b.voter_id = u.id) AS ballots_submitted
         FROM users u
         $whereSql
         ORDER BY u.created_at DESC
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
    app_log('error', 'List voters failed', ['error' => $e->getMessage()]);
    json_error('Unable to list voters', 500);
}
