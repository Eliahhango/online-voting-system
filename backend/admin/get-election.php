<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/admin-auth.php';

require_method('GET');

require_admin_auth();
$electionId = int_param('election_id');
if (!$electionId) {
    json_error('election_id is required', 422, ['election_id' => 'election_id is required']);
}

try {
    $pdo = db();

    $electionStmt = $pdo->prepare(
        "SELECT
            e.id,
            e.title,
            e.description,
            e.start_at,
            e.end_at,
            e.status,
            e.visibility,
            e.created_at,
            e.updated_at
         FROM elections e
         WHERE e.id = :election_id
         LIMIT 1"
    );
    $electionStmt->execute(['election_id' => $electionId]);
    $election = $electionStmt->fetch();

    if (!$election) {
        json_error('Election not found', 404);
    }

    $positionsStmt = $pdo->prepare(
        "SELECT
            p.id,
            p.parent_position_id,
            p.title,
            p.description,
            p.seat_count,
            p.sort_order,
            (SELECT COUNT(*) FROM candidates c WHERE c.position_id = p.id AND c.election_id = p.election_id AND c.status = 'active') AS candidates_count
         FROM positions p
         WHERE p.election_id = :election_id
         ORDER BY p.sort_order ASC, p.id ASC"
    );
    $positionsStmt->execute(['election_id' => $electionId]);
    $positions = $positionsStmt->fetchAll();

    $candidatesStmt = $pdo->prepare(
        "SELECT
            c.id,
            c.full_name,
            c.party,
            c.bio,
            c.photo_path,
            c.position_id,
            c.status,
            p.title AS position_title
         FROM candidates c
         INNER JOIN positions p ON p.id = c.position_id AND p.election_id = c.election_id
         WHERE c.election_id = :election_id
         ORDER BY p.sort_order ASC, c.full_name ASC"
    );
    $candidatesStmt->execute(['election_id' => $electionId]);
    $candidates = $candidatesStmt->fetchAll();

    json_success([
        'election' => $election,
        'positions' => $positions,
        'candidates' => $candidates,
    ]);
} catch (Throwable $e) {
    app_log('error', 'Get election failed', ['error' => $e->getMessage(), 'election_id' => $electionId]);
    json_error('Unable to fetch election', 500);
}
