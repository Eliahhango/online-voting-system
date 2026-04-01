<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/admin-auth.php';

require_method(['POST', 'DELETE']);

$admin = require_admin_auth();
$input = get_json_input();
$electionId = (int) ($input['election_id'] ?? query_param('election_id', 0));

if ($electionId <= 0) {
    json_error('election_id is required', 422, ['election_id' => 'election_id is required']);
}

try {
    $pdo = db();

    $exists = $pdo->prepare('SELECT id, status FROM elections WHERE id = :id LIMIT 1');
    $exists->execute(['id' => $electionId]);
    $election = $exists->fetch();

    if (!$election) {
        json_error('Election not found', 404);
    }

    $ballotsStmt = $pdo->prepare('SELECT COUNT(*) FROM ballots WHERE election_id = :election_id');
    $ballotsStmt->execute(['election_id' => $electionId]);
    $ballotsCount = (int) $ballotsStmt->fetchColumn();

    if ($ballotsCount > 0) {
        $closeStmt = $pdo->prepare('UPDATE elections SET status = :status, updated_at = CURRENT_TIMESTAMP WHERE id = :id');
        $closeStmt->execute([
            'status' => ELECTION_STATUS_CLOSED,
            'id' => $electionId,
        ]);

        audit_log('admin.close_election', (int) $admin['id'], ['election_id' => $electionId]);

        json_success([
            'action' => 'closed',
            'reason' => 'Election had ballots, so it was closed instead of deleted',
            'election_id' => $electionId,
        ], 'Election closed successfully');
    }

    $deleteStmt = $pdo->prepare('DELETE FROM elections WHERE id = :id');
    $deleteStmt->execute(['id' => $electionId]);

    audit_log('admin.delete_election', (int) $admin['id'], ['election_id' => $electionId]);

    json_success([
        'action' => 'deleted',
        'election_id' => $electionId,
    ], 'Election deleted successfully');
} catch (Throwable $e) {
    app_log('error', 'Delete election failed', ['error' => $e->getMessage(), 'admin_id' => (int) $admin['id']]);
    json_error('Unable to delete election', 500);
}
