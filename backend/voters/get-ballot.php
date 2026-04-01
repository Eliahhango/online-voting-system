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
        "SELECT id, title, description, start_at, end_at, status,
                CASE
                    WHEN status = 'closed' THEN 'closed'
                    WHEN CURRENT_TIMESTAMP < start_at THEN 'upcoming'
                    WHEN CURRENT_TIMESTAMP > end_at THEN 'closed'
                    ELSE 'active'
                END AS phase
         FROM elections
         WHERE id = :election_id
         LIMIT 1"
    );
    $electionStmt->execute(['election_id' => $electionId]);
    $election = $electionStmt->fetch();

    if (!$election) {
        json_error('Election not found', 404);
    }

    if ((string) ($election['status'] ?? '') !== ELECTION_STATUS_PUBLISHED) {
        json_error('Election is not open for voting', 403);
    }

    $now = time();
    $startAt = strtotime((string) ($election['start_at'] ?? ''));
    $endAt = strtotime((string) ($election['end_at'] ?? ''));
    if ($startAt === false || $endAt === false || $now < $startAt || $now > $endAt) {
        json_error('Voting window is closed for this election', 403, [], [
            'phase' => $election['phase'] ?? null,
        ]);
    }

    $votedStmt = $pdo->prepare('SELECT receipt_code, submitted_at FROM ballots WHERE election_id = :election_id AND voter_id = :voter_id LIMIT 1');
    $votedStmt->execute([
        'election_id' => $electionId,
        'voter_id' => (int) $user['id'],
    ]);
    $existingBallot = $votedStmt->fetch();

    $posStmt = $pdo->prepare(
        'SELECT id, title, description, seat_count, sort_order
         FROM positions
         WHERE election_id = :election_id
         ORDER BY sort_order ASC, id ASC'
    );
    $posStmt->execute(['election_id' => $electionId]);
    $positions = $posStmt->fetchAll();

    $candStmt = $pdo->prepare(
        "SELECT c.id, c.position_id, c.full_name, c.party, c.bio, c.photo_path, c.manifesto
         FROM candidates c
         INNER JOIN positions p ON p.id = c.position_id AND p.election_id = c.election_id
         WHERE c.election_id = :election_id
           AND c.status = 'active'
         ORDER BY c.full_name ASC"
    );
    $candStmt->execute(['election_id' => $electionId]);
    $candidates = $candStmt->fetchAll();

    $candidateByPosition = [];
    foreach ($candidates as $candidate) {
        $positionId = (int) $candidate['position_id'];
        if (!isset($candidateByPosition[$positionId])) {
            $candidateByPosition[$positionId] = [];
        }
        $candidateByPosition[$positionId][] = $candidate;
    }

    $ballotPositions = [];
    foreach ($positions as $position) {
        $pid = (int) $position['id'];
        $position['candidates'] = $candidateByPosition[$pid] ?? [];
        $ballotPositions[] = $position;
    }

    json_success([
        'election' => $election,
        'already_submitted' => (bool) $existingBallot,
        'existing_ballot' => $existingBallot ?: null,
        'positions' => $ballotPositions,
    ]);
} catch (Throwable $e) {
    app_log('error', 'Get ballot failed', ['error' => $e->getMessage(), 'user_id' => (int) $user['id']]);
    json_error('Unable to fetch ballot', 500);
}
