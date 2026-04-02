INSERT INTO users (id, full_name, email, phone, voter_id, password_hash, role, status, is_verified)
VALUES
    (1, 'System Admin', 'admin@ovs.local', '+255700000001', 'ADM-0001', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'active', 1),
    (2, 'Demo Voter', 'voter@ovs.local', '+255700000002', 'VOT-0001', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'voter', 'active', 1)
ON DUPLICATE KEY UPDATE
    full_name = VALUES(full_name),
    email = VALUES(email),
    phone = VALUES(phone),
    voter_id = VALUES(voter_id),
    password_hash = VALUES(password_hash),
    role = VALUES(role),
    status = VALUES(status),
    is_verified = VALUES(is_verified);

INSERT INTO elections (id, title, description, start_at, end_at, status, visibility, created_by)
VALUES
    (1, 'City Council Election 2026', 'Municipal council leadership election.', NOW() - INTERVAL 1 DAY, NOW() + INTERVAL 6 DAY, 'published', 'public', 1)
ON DUPLICATE KEY UPDATE
    title = VALUES(title),
    description = VALUES(description),
    start_at = VALUES(start_at),
    end_at = VALUES(end_at),
    status = VALUES(status),
    visibility = VALUES(visibility),
    created_by = VALUES(created_by);

INSERT INTO positions (id, election_id, title, seat_count, sort_order, description)
VALUES
    (1, 1, 'Mayor', 1, 1, 'City mayoral seat'),
    (2, 1, 'Council Chairperson', 1, 2, 'Council chairperson seat')
ON DUPLICATE KEY UPDATE
    election_id = VALUES(election_id),
    title = VALUES(title),
    seat_count = VALUES(seat_count),
    sort_order = VALUES(sort_order),
    description = VALUES(description);

INSERT INTO candidates (id, election_id, position_id, full_name, party, bio, status)
VALUES
    (1, 1, 1, 'Asha Mwakalinga', 'Civic Reform Party', 'Public policy specialist.', 'active'),
    (2, 1, 1, 'Daniel Mrema', 'People First', 'Community development advocate.', 'active'),
    (3, 1, 2, 'Neema Kipanga', 'Independent', 'Governance and transparency activist.', 'active'),
    (4, 1, 2, 'John Msuya', 'Unity Alliance', 'Former municipal planner.', 'active')
ON DUPLICATE KEY UPDATE
    election_id = VALUES(election_id),
    position_id = VALUES(position_id),
    full_name = VALUES(full_name),
    party = VALUES(party),
    bio = VALUES(bio),
    status = VALUES(status);

INSERT INTO settings (`key`, value, namespace)
VALUES
    ('site_name', 'Online Voting System', 'general'),
    ('results_visibility', 'after_close', 'security'),
    ('password_min_length', '8', 'security')
ON DUPLICATE KEY UPDATE
    value = VALUES(value),
    namespace = VALUES(namespace);