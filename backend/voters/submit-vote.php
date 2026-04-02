<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/voter-auth.php';
require_once __DIR__ . '/../helpers/sanitizer.php';

require_method('POST');

$user = require_voter_auth();
require_same_origin_request();
$input = get_json_input();

$electionId = sanitize_int($input['election_id'] ?? 0);
$rawVotes = $input['votes'] ?? [];

if ($electionId <= 0) {
    json_error('election_id is required', 422, ['election_id' => 'election_id must be a valid integer']);
}

if (!is_array($rawVotes) || empty($rawVotes)) {
    json_error('votes are required', 422, ['votes' => 'votes must be a non-empty array']);
}

function parse_vote_rows(array $rawVotes): array
{
    $parsed = [];

    $isList = array_keys($rawVotes) === range(0, count($rawVotes) - 1);

    if ($isList) {
        foreach ($rawVotes as $row) {
            if (!is_array($row)) {
                continue;
            }

            $positionId = isset($row['position_id']) ? (int) $row['position_id'] : 0;
            $candidateId = isset($row['candidate_id']) ? (int) $row['candidate_id'] : 0;

            if ($positionId > 0 && $candidateId > 0) {
                $parsed[] = [
                    'position_id' => $positionId,
                    'candidate_id' => $candidateId,
                ];
            }
        }

        return $parsed;
    }

    foreach ($rawVotes as $positionId => $candidateId) {
        $pid = (int) $positionId;
        $cid = (int) $candidateId;
        if ($pid > 0 && $cid > 0) {
            $parsed[] = [
                'position_id' => $pid,
                'candidate_id' => $cid,
            ];
        }
    }

    return $parsed;
}

$votes = parse_vote_rows($rawVotes);
if (empty($votes)) {
    json_error('No valid votes found', 422, ['votes' => 'Provide position_id and candidate_id pairs']);
}

function is_unique_constraint_violation(Throwable $e): bool
{
    if ($e instanceof PDOException && (string) $e->getCode() === '23000') {
        return true;
    }
    $message = strtolower($e->getMessage());
    return strpos($message, 'unique') !== false || strpos($message, 'constraint') !== false;
}

try {
    $pdo = db();
    $txnStarted = false;

    $electionStmt = $pdo->prepare('SELECT id, title, start_at, end_at, status FROM elections WHERE id = :id LIMIT 1');
    $electionStmt->execute(['id' => $electionId]);
    $election = $electionStmt->fetch();

    if (!$election) {
        json_error('Election not found', 404);
    }

    if ((string) $election['status'] !== ELECTION_STATUS_PUBLISHED) {
        json_error('Election is not open for voting', 400);
    }

    $now = time();
    $startAt = strtotime((string) $election['start_at']);
    $endAt = strtotime((string) $election['end_at']);
    if ($startAt === false || $endAt === false || $now < $startAt || $now > $endAt) {
        json_error('Voting window is closed for this election', 400);
    }

    $positionStmt = $pdo->prepare('SELECT id FROM positions WHERE election_id = :election_id');
    $positionStmt->execute(['election_id' => $electionId]);
    $validPositions = array_map('intval', array_column($positionStmt->fetchAll(), 'id'));

    if (empty($validPositions)) {
        json_error('Election has no positions configured', 400);
    }

    if (count($votes) !== count($validPositions)) {
        json_error('Complete ballot required', 422, ['votes' => 'You must submit one selection for every position']);
    }

    $positionIds = array_map(static fn($vote) => (int) $vote['position_id'], $votes);
    if (count($positionIds) !== count(array_unique($positionIds))) {
        json_error('Duplicate position votes are not allowed', 422);
    }

    foreach ($votes as $vote) {
        if (!in_array((int) $vote['position_id'], $validPositions, true)) {
            json_error('Invalid position selected', 422, ['position_id' => 'One or more selected positions are invalid']);
        }

        $candidateStmt = $pdo->prepare(
            'SELECT id FROM candidates
             WHERE id = :candidate_id
               AND position_id = :position_id
               AND election_id = :election_id
               AND status = :status
             LIMIT 1'
        );
        $candidateStmt->execute([
            'candidate_id' => (int) $vote['candidate_id'],
            'position_id' => (int) $vote['position_id'],
            'election_id' => $electionId,
            'status' => 'active',
        ]);

        if (!$candidateStmt->fetch()) {
            json_error('Invalid candidate selected', 422, ['candidate_id' => 'Candidate is invalid for the selected position']);
        }
    }

    $pdo->beginTransaction();
    $txnStarted = true;

    $existingBallotStmt = $pdo->prepare('SELECT id FROM ballots WHERE election_id = :election_id AND voter_id = :voter_id LIMIT 1');
    $existingBallotStmt->execute([
        'election_id' => $electionId,
        'voter_id' => (int) $user['id'],
    ]);
    if ($existingBallotStmt->fetch()) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
            $txnStarted = false;
        }
        json_error('You have already submitted a vote for this election', 409);
    }

    $receiptCode = 'VOTE-' . strtoupper(bin2hex(random_bytes(5)));

    $ballotInsert = $pdo->prepare(
        'INSERT INTO ballots (election_id, voter_id, receipt_code, submitted_at)
         VALUES (:election_id, :voter_id, :receipt_code, CURRENT_TIMESTAMP)'
    );
    $ballotInsert->execute([
        'election_id' => $electionId,
        'voter_id' => (int) $user['id'],
        'receipt_code' => $receiptCode,
    ]);

    $voteInsert = $pdo->prepare(
        'INSERT INTO votes (election_id, position_id, candidate_id, voter_id, created_at)
         VALUES (:election_id, :position_id, :candidate_id, :voter_id, CURRENT_TIMESTAMP)'
    );

    foreach ($votes as $vote) {
        $voteInsert->execute([
            'election_id' => $electionId,
            'position_id' => (int) $vote['position_id'],
            'candidate_id' => (int) $vote['candidate_id'],
            'voter_id' => (int) $user['id'],
        ]);
    }

    if ($txnStarted) {
        $pdo->commit();
        $txnStarted = false;
    }

    audit_log('voter.submit_vote', (int) $user['id'], [
        'election_id' => $electionId,
        'vote_count' => count($votes),
        'receipt_code' => $receiptCode,
    ]);

    json_success([
        'receipt_code' => $receiptCode,
        'submitted_at' => date('c'),
        'election_id' => $electionId,
    ], 'Vote submitted successfully', 201);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
    }

    if (is_unique_constraint_violation($e)) {
        json_error('Duplicate submission detected. This ballot has already been submitted.', 409);
    }

    app_log('error', 'Submit vote failed', ['error' => $e->getMessage(), 'user_id' => (int) $user['id']]);
    json_error('Unable to submit vote', 500);
}
