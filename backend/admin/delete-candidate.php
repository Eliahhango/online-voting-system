<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/admin-auth.php';
require_once __DIR__ . '/../helpers/election-guard.php';

require_method(['POST', 'DELETE']);

$admin = require_admin_auth();
$input = get_json_input();
$candidateId = (int) ($input['candidate_id'] ?? query_param('candidate_id', 0));

if ($candidateId <= 0) {
    json_error('candidate_id is required', 422, ['candidate_id' => 'candidate_id is required']);
}

try {
    $pdo = db();

    $exists = $pdo->prepare('SELECT id, election_id FROM candidates WHERE id = :id LIMIT 1');
    $exists->execute(['id' => $candidateId]);
    $candidate = $exists->fetch();
    if (!$candidate) {
        json_error('Candidate not found', 404);
    }

    $electionId = (int) $candidate['election_id'];
    $electionStmt = $pdo->prepare('SELECT id, status, start_at, end_at FROM elections WHERE id = :id LIMIT 1');
    $electionStmt->execute(['id' => $electionId]);
    $election = $electionStmt->fetch();
    if (!$election) {
        json_error('Election not found', 404);
    }

    $ballotsCount = election_ballots_count($pdo, $electionId);
    if (election_structure_locked($election, $ballotsCount)) {
        json_error('Election structure is locked for editing', 409, [
            'candidate_id' => 'Cannot delete candidates after election has started, closed, or received ballots',
        ]);
    }

    $votesStmt = $pdo->prepare('SELECT COUNT(*) FROM votes WHERE candidate_id = :candidate_id');
    $votesStmt->execute(['candidate_id' => $candidateId]);
    $voteCount = (int) $votesStmt->fetchColumn();
    if ($voteCount > 0) {
        json_error('Candidate has recorded votes and cannot be deleted', 409, [
            'candidate_id' => 'Use status update (inactive) before election starts',
        ]);
    }

    $stmt = $pdo->prepare('DELETE FROM candidates WHERE id = :id');
    $stmt->execute(['id' => $candidateId]);

    audit_log('admin.delete_candidate', (int) $admin['id'], ['candidate_id' => $candidateId]);

    json_success(['candidate_id' => $candidateId], 'Candidate deleted successfully');
} catch (Throwable $e) {
    app_log('error', 'Delete candidate failed', ['error' => $e->getMessage(), 'admin_id' => (int) $admin['id']]);
    json_error('Unable to delete candidate', 500);
}
