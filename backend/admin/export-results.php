<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/admin-auth.php';

require_method(['GET', 'POST']);

$admin = require_admin_auth();
$input = get_json_input();
$electionId = (int) ($input['election_id'] ?? query_param('election_id', 0));

if ($electionId <= 0) {
    json_error('election_id is required', 422, ['election_id' => 'election_id is required']);
}

try {
    $pdo = db();

    $electionStmt = $pdo->prepare('SELECT id, title FROM elections WHERE id = :id LIMIT 1');
    $electionStmt->execute(['id' => $electionId]);
    $election = $electionStmt->fetch();

    if (!$election) {
        json_error('Election not found', 404);
    }

    $rowsStmt = $pdo->prepare(
        "SELECT
            e.id AS election_id,
            e.title AS election_title,
            p.id AS position_id,
            p.title AS position_title,
            c.id AS candidate_id,
            c.full_name AS candidate_name,
            c.party,
            COUNT(v.id) AS vote_count
         FROM elections e
         INNER JOIN positions p ON p.election_id = e.id
         LEFT JOIN candidates c ON c.position_id = p.id AND c.election_id = e.id
         LEFT JOIN votes v ON v.candidate_id = c.id AND v.position_id = p.id AND v.election_id = e.id
         WHERE e.id = :election_id
         GROUP BY e.id, e.title, p.id, p.title, c.id, c.full_name, c.party
         ORDER BY p.sort_order ASC, vote_count DESC, c.full_name ASC"
    );
    $rowsStmt->execute(['election_id' => $electionId]);
    $rows = $rowsStmt->fetchAll();

    $safeTitle = preg_replace('/[^A-Za-z0-9_\-]+/', '_', (string) $election['title']);
    $filename = sprintf('results_%s_%s.csv', $safeTitle, date('Ymd_His'));

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');

    $out = fopen('php://output', 'w');
    fputcsv($out, ['election_id', 'election_title', 'position_id', 'position_title', 'candidate_id', 'candidate_name', 'party', 'vote_count']);

    foreach ($rows as $row) {
        fputcsv($out, [
            $row['election_id'],
            $row['election_title'],
            $row['position_id'],
            $row['position_title'],
            $row['candidate_id'],
            $row['candidate_name'],
            $row['party'],
            $row['vote_count'],
        ]);
    }

    fclose($out);

    audit_log('admin.export_results', (int) $admin['id'], [
        'election_id' => $electionId,
        'rows' => count($rows),
    ]);

    exit;
} catch (Throwable $e) {
    app_log('error', 'Export results failed', ['error' => $e->getMessage(), 'admin_id' => (int) $admin['id']]);
    json_error('Unable to export results', 500);
}
