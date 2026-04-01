INSERT OR IGNORE INTO users (id, full_name, email, phone, voter_id, password_hash, role, status, is_verified)
VALUES
    (1, 'System Admin', 'admin@ovs.local', '+255700000001', 'ADM-0001', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'active', 1),
    (2, 'Demo Voter', 'voter@ovs.local', '+255700000002', 'VOT-0001', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'voter', 'active', 1);

INSERT OR IGNORE INTO elections (id, title, description, start_at, end_at, status, visibility, created_by)
VALUES
    (1, 'City Council Election 2026', 'Municipal council leadership election.', datetime('now', '-1 day'), datetime('now', '+6 day'), 'published', 'public', 1);

INSERT OR IGNORE INTO positions (id, election_id, title, seat_count, sort_order, description)
VALUES
    (1, 1, 'Mayor', 1, 1, 'City mayoral seat'),
    (2, 1, 'Council Chairperson', 1, 2, 'Council chairperson seat');

INSERT OR IGNORE INTO candidates (id, election_id, position_id, full_name, party, bio, status)
VALUES
    (1, 1, 1, 'Asha Mwakalinga', 'Civic Reform Party', 'Public policy specialist.', 'active'),
    (2, 1, 1, 'Daniel Mrema', 'People First', 'Community development advocate.', 'active'),
    (3, 1, 2, 'Neema Kipanga', 'Independent', 'Governance and transparency activist.', 'active'),
    (4, 1, 2, 'John Msuya', 'Unity Alliance', 'Former municipal planner.', 'active');

INSERT OR IGNORE INTO settings (key, value, namespace)
VALUES
    ('site_name', 'Online Voting System', 'general'),
    ('results_visibility', 'after_close', 'security'),
    ('password_min_length', '8', 'security');
