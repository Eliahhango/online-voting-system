<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/voter-auth.php';

require_method('GET');

require_voter_auth();
$electionId = int_param('election_id');

try {
    $pdo = db();

    if (!$electionId) {
        $latestStmt = $pdo->query(
            "SELECT id
             FROM elections
             WHERE status = 'closed'
                OR (status = 'published' AND CURRENT_TIMESTAMP > end_at)
             ORDER BY end_at DESC
             LIMIT 1"
        );
        $electionId = (int) $latestStmt->fetchColumn();
    }

    if (!$electionId) {
        json_error('No completed elections found', 404);
    }

    $electionStmt = $pdo->prepare('SELECT id, title, description, start_at, end_at, status FROM elections WHERE id = :id LIMIT 1');
    $electionStmt->execute(['id' => $electionId]);
    $election = $electionStmt->fetch();
    if (!$election) {
        json_error('Election not found', 404);
    }

    $status = (string) ($election['status'] ?? '');
    $endTs = strtotime((string) ($election['end_at'] ?? ''));
    $now = time();
    $isCompleted = $status === ELECTION_STATUS_CLOSED || ($endTs !== false && $now > $endTs);
    if (!$isCompleted) {
        json_error(
            'Results are available only after election closes',
            403,
            [],
            [
                'status' => $status,
                'available_at' => $endTs !== false ? date('c', $endTs) : null,
            ]
        );
    }

    $rowsStmt = $pdo->prepare(
        "SELECT
            p.id AS position_id,
            p.title AS position_title,
            p.sort_order,
            c.id AS candidate_id,
            c.full_name AS candidate_name,
            c.party,
            COUNT(v.id) AS vote_count
         FROM positions p
         LEFT JOIN candidates c ON c.position_id = p.id AND c.election_id = p.election_id AND c.status = 'active'
         LEFT JOIN votes v ON v.candidate_id = c.id AND v.position_id = p.id AND v.election_id = p.election_id
         WHERE p.election_id = :election_id
         GROUP BY p.id, p.title, p.sort_order, c.id, c.full_name, c.party
         ORDER BY p.sort_order ASC, vote_count DESC, c.full_name ASC"
    );
    $rowsStmt->execute(['election_id' => $electionId]);
    $rows = $rowsStmt->fetchAll();

    $grouped = [];
    foreach ($rows as $row) {
        $pid = (int) $row['position_id'];
        if (!isset($grouped[$pid])) {
            $grouped[$pid] = [
                'position_id' => $pid,
                'position_title' => $row['position_title'],
                'candidates' => [],
                'winner_candidate_id' => null,
                'winner_vote_count' => null,
            ];
        }

        if ($row['candidate_id'] === null) {
            continue;
        }

        $candidate = [
            'candidate_id' => (int) $row['candidate_id'],
            'candidate_name' => $row['candidate_name'],
            'party' => $row['party'],
            'vote_count' => (int) $row['vote_count'],
        ];

        $grouped[$pid]['candidates'][] = $candidate;

        if (
            $grouped[$pid]['winner_vote_count'] === null
            || $candidate['vote_count'] > $grouped[$pid]['winner_vote_count']
        ) {
            $grouped[$pid]['winner_candidate_id'] = $candidate['candidate_id'];
            $grouped[$pid]['winner_vote_count'] = $candidate['vote_count'];
        }
    }

    $cutoff = $endTs !== false ? date('Y-m-d H:i:s', $endTs) : date('Y-m-d H:i:s');
    $eligibleStmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE role = 'voter' AND created_at <= :cutoff");
    $eligibleStmt->execute(['cutoff' => $cutoff]);
    $eligibleVoters = (int) $eligibleStmt->fetchColumn();

    $ballotsStmt = $pdo->prepare('SELECT COUNT(*) FROM ballots WHERE election_id = :election_id');
    $ballotsStmt->execute(['election_id' => $electionId]);
    $ballotsCast = (int) $ballotsStmt->fetchColumn();

    $turnout = $eligibleVoters > 0 ? round(($ballotsCast / $eligibleVoters) * 100, 2) : 0.0;

    json_success([
        'election' => $election,
        'summary' => [
            'eligible_voters' => $eligibleVoters,
            'ballots_cast' => $ballotsCast,
            'turnout_percent' => $turnout,
        ],
        'positions' => array_values($grouped),
        'generated_at' => date('c'),
    ]);
} catch (Throwable $e) {
    app_log('error', 'Get voter results failed', ['error' => $e->getMessage()]);
    json_error('Unable to fetch results', 500);
}
