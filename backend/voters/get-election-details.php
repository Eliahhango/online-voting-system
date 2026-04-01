<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/voter-auth.php';

require_method('GET');

$user = require_voter_auth();
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
            CASE
                WHEN e.status = 'closed' THEN 'closed'
                WHEN CURRENT_TIMESTAMP < e.start_at THEN 'upcoming'
                WHEN CURRENT_TIMESTAMP > e.end_at THEN 'closed'
                ELSE 'active'
            END AS phase,
            EXISTS(
                SELECT 1 FROM ballots b
                WHERE b.election_id = e.id
                  AND b.voter_id = :voter_id
            ) AS has_voted
         FROM elections e
         WHERE e.id = :election_id
         LIMIT 1"
    );
    $electionStmt->execute([
        'election_id' => $electionId,
        'voter_id' => (int) $user['id'],
    ]);
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

    $previewStmt = $pdo->prepare(
        "SELECT
            c.id,
            c.full_name,
            c.party,
            c.bio,
            c.photo_path,
            c.position_id,
            p.title AS position_title
         FROM candidates c
         INNER JOIN positions p ON p.id = c.position_id AND p.election_id = c.election_id
         WHERE c.election_id = :election_id
           AND c.status = 'active'
         ORDER BY p.sort_order ASC, c.full_name ASC"
    );
    $previewStmt->execute(['election_id' => $electionId]);
    $candidatePreview = $previewStmt->fetchAll();

    $activeCandidatesTotal = 0;
    foreach ($positions as $position) {
        $activeCandidatesTotal += (int) ($position['candidates_count'] ?? 0);
    }

    $totalSeats = 0;
    foreach ($positions as $position) {
        $totalSeats += (int) ($position['seat_count'] ?? 0);
    }

    $ballotsStmt = $pdo->prepare('SELECT COUNT(*) FROM ballots WHERE election_id = :election_id');
    $ballotsStmt->execute(['election_id' => $electionId]);
    $ballotsCast = (int) $ballotsStmt->fetchColumn();

    json_success([
        'election' => $election,
        'summary' => [
            'positions_count' => count($positions),
            'candidates_count' => $activeCandidatesTotal,
            'seats_total' => $totalSeats,
            'ballots_cast' => $ballotsCast,
        ],
        'positions' => $positions,
        'candidate_preview' => $candidatePreview,
    ]);
} catch (Throwable $e) {
    app_log('error', 'Get election details failed', ['error' => $e->getMessage(), 'user_id' => (int) $user['id']]);
    json_error('Unable to fetch election details', 500);
}
