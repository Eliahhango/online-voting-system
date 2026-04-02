<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/voter-auth.php';

require_method('GET');

$user = require_voter_auth();

try {
    $pdo = db();

    $availableStmt = $pdo->query("SELECT COUNT(*) FROM elections WHERE status IN ('published', 'closed')");
    $availableElections = (int) $availableStmt->fetchColumn();

    $activeStmt = $pdo->query("SELECT COUNT(*) FROM elections WHERE status = 'published' AND CURRENT_TIMESTAMP >= start_at AND CURRENT_TIMESTAMP <= end_at");
    $activeElections = (int) $activeStmt->fetchColumn();

    $votedStmt = $pdo->prepare('SELECT COUNT(*) FROM ballots WHERE voter_id = :voter_id');
    $votedStmt->execute(['voter_id' => (int) $user['id']]);
    $votedElections = (int) $votedStmt->fetchColumn();

    $upcomingStmt = $pdo->query("SELECT COUNT(*) FROM elections WHERE status = 'published' AND CURRENT_TIMESTAMP < start_at");
    $upcomingElections = (int) $upcomingStmt->fetchColumn();

    json_success([
        'available_elections' => $availableElections,
        'active_elections' => $activeElections,
        'upcoming_elections' => $upcomingElections,
        'voted_elections' => $votedElections,
    ]);
} catch (Throwable $e) {
    app_log('error', 'Voter dashboard stats failed', ['error' => $e->getMessage(), 'user_id' => (int) $user['id']]);
    json_error('Unable to load dashboard stats', 500);
}
