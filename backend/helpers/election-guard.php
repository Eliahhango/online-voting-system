<?php
declare(strict_types=1);

function election_timestamp(?string $value): ?int
{
    if ($value === null || trim($value) === '') {
        return null;
    }

    $ts = strtotime($value);
    return $ts === false ? null : $ts;
}

function election_has_started(array $election): bool
{
    $startAt = election_timestamp((string) ($election['start_at'] ?? ''));
    if ($startAt === null) {
        return false;
    }

    return time() >= $startAt;
}

function election_is_closed(array $election): bool
{
    return strtolower((string) ($election['status'] ?? '')) === ELECTION_STATUS_CLOSED;
}

function election_structure_locked(array $election, int $ballotsCount): bool
{
    if ($ballotsCount > 0) {
        return true;
    }

    if (election_is_closed($election)) {
        return true;
    }

    return strtolower((string) ($election['status'] ?? '')) === ELECTION_STATUS_PUBLISHED && election_has_started($election);
}

function election_find_overlapping_published(PDO $pdo, string $startAt, string $endAt, ?int $excludeElectionId = null): ?array
{
    $sql =
        "SELECT id, title, start_at, end_at
         FROM elections
         WHERE status = :published
           AND NOT (end_at <= :start_at OR start_at >= :end_at)";

    $params = [
        'published' => ELECTION_STATUS_PUBLISHED,
        'start_at' => $startAt,
        'end_at' => $endAt,
    ];

    if ($excludeElectionId !== null && $excludeElectionId > 0) {
        $sql .= ' AND id <> :exclude_id';
        $params['exclude_id'] = $excludeElectionId;
    }

    $sql .= ' ORDER BY start_at ASC LIMIT 1';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch();

    return $row ?: null;
}

function election_ballots_count(PDO $pdo, int $electionId): int
{
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM ballots WHERE election_id = :election_id');
    $stmt->execute(['election_id' => $electionId]);

    return (int) $stmt->fetchColumn();
}

function election_publish_readiness(PDO $pdo, int $electionId): array
{
    $errors = [];
    $descriptionPresent = false;

    $electionStmt = $pdo->prepare(
        'SELECT id, title, description, start_at, end_at, status FROM elections WHERE id = :election_id LIMIT 1'
    );
    $electionStmt->execute(['election_id' => $electionId]);
    $election = $electionStmt->fetch();
    if (!$election) {
        return [
            'ok' => false,
            'errors' => ['election' => 'Election not found'],
            'meta' => [
                'description_present' => false,
                'positions_total' => 0,
                'positions_ready' => 0,
                'active_candidates_total' => 0,
                'missing_positions' => [],
            ],
        ];
    }

    $description = trim((string) ($election['description'] ?? ''));
    if ($description === '') {
        $errors['description'] = 'Election description is required before publishing';
    } else {
        $descriptionPresent = true;
    }

    $positionsStmt = $pdo->prepare(
        "SELECT
            p.id,
            p.title,
            p.sort_order,
            SUM(CASE WHEN c.id IS NULL THEN 0 ELSE 1 END) AS active_candidates
         FROM positions p
         LEFT JOIN candidates c
            ON c.position_id = p.id
           AND c.election_id = p.election_id
           AND c.status = 'active'
         WHERE p.election_id = :election_id
         GROUP BY p.id, p.title, p.sort_order
         ORDER BY p.sort_order ASC, p.id ASC"
    );
    $positionsStmt->execute(['election_id' => $electionId]);
    $positions = $positionsStmt->fetchAll();

    if (empty($positions)) {
        $errors['positions'] = 'At least one position is required before publishing';
        return [
            'ok' => false,
            'errors' => $errors,
            'meta' => [
                'description_present' => $descriptionPresent,
                'positions_total' => 0,
                'positions_ready' => 0,
                'active_candidates_total' => 0,
                'missing_positions' => [],
            ],
        ];
    }

    $missing = [];
    $ready = 0;
    $activeCandidatesTotal = 0;
    foreach ($positions as $position) {
        $count = (int) ($position['active_candidates'] ?? 0);
        $activeCandidatesTotal += $count;
        if ($count < 1) {
            $missing[] = [
                'position_id' => (int) $position['id'],
                'position_title' => (string) $position['title'],
            ];
        } else {
            $ready += 1;
        }
    }

    if (!empty($missing)) {
        $first = $missing[0];
        $errors['candidates'] = 'Each position must have at least one active candidate. Missing: ' . $first['position_title'];
    }

    return [
        'ok' => empty($errors),
        'errors' => $errors,
        'meta' => [
            'description_present' => $descriptionPresent,
            'positions_total' => count($positions),
            'positions_ready' => $ready,
            'active_candidates_total' => $activeCandidatesTotal,
            'missing_positions' => $missing,
        ],
    ];
}
