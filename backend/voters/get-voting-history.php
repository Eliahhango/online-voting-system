<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/voter-auth.php';

require_method('GET');

$user = require_voter_auth();
[$page, $limit, $offset] = paginate_clause();

try {
    $pdo = db();

    $countStmt = $pdo->prepare('SELECT COUNT(*) FROM ballots WHERE voter_id = :voter_id');
    $countStmt->execute(['voter_id' => (int) $user['id']]);
    $total = (int) $countStmt->fetchColumn();

    $stmt = $pdo->prepare(
        "SELECT
            b.id,
            b.election_id,
            e.title AS election_title,
            e.status AS election_status,
            b.receipt_code,
            b.submitted_at,
            (SELECT COUNT(*) FROM votes v WHERE v.election_id = b.election_id AND v.voter_id = b.voter_id) AS vote_items
         FROM ballots b
         INNER JOIN elections e ON e.id = b.election_id
         WHERE b.voter_id = :voter_id
         ORDER BY b.submitted_at DESC
         LIMIT :limit OFFSET :offset"
    );

    $stmt->bindValue(':voter_id', (int) $user['id'], PDO::PARAM_INT);
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();

    $items = $stmt->fetchAll();

    json_success([
        'items' => $items,
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'total_pages' => $limit > 0 ? (int) ceil($total / $limit) : 1,
        ],
    ]);
} catch (Throwable $e) {
    app_log('error', 'Get voting history failed', ['error' => $e->getMessage(), 'user_id' => (int) $user['id']]);
    json_error('Unable to fetch voting history', 500);
}
