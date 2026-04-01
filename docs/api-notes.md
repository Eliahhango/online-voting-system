# API Notes

Base backend path: `/backend`

## Authentication
- `POST /backend/auth/register.php`
- `POST /backend/auth/login.php`
- `POST|GET /backend/auth/logout.php`
- `POST /backend/auth/forgot-password.php`
- `POST /backend/auth/reset-password.php`
- `GET /backend/auth/get-session.php`
- `POST /backend/auth/verify-account.php`

## Voter Endpoints (session + voter role)
- `GET /backend/voters/get-profile.php`
- `POST|PUT|PATCH /backend/voters/update-profile.php`
- `GET /backend/voters/get-elections.php`
- `GET /backend/voters/get-election-details.php?election_id={id}`
- `GET /backend/voters/get-ballot.php?election_id={id}`
- `POST /backend/voters/submit-vote.php`
- `GET /backend/voters/get-results.php?election_id={id}`
- `GET /backend/voters/get-voting-history.php`

## Admin Endpoints (session + admin role)
- `GET /backend/admin/dashboard-stats.php`
- `GET /backend/admin/list-elections.php`
- `POST /backend/admin/create-election.php`
- `POST|PUT|PATCH /backend/admin/update-election.php`
- `POST|DELETE /backend/admin/delete-election.php`
- `GET /backend/admin/list-positions.php`
- `POST /backend/admin/create-position.php`
- `GET /backend/admin/list-candidates.php`
- `POST /backend/admin/add-candidate.php`
- `POST|PUT|PATCH /backend/admin/update-candidate.php`
- `POST|DELETE /backend/admin/delete-candidate.php`
- `GET /backend/admin/list-voters.php`
- `POST /backend/admin/add-voter.php`
- `POST|PUT|PATCH /backend/admin/update-voter-status.php`
- `GET /backend/admin/get-results.php`
- `GET|POST /backend/admin/export-results.php`
- `GET|POST|PUT /backend/admin/settings.php`

## Seed Credentials (development)
- Admin: `admin@ovs.local` / `password`
- Voter: `voter@ovs.local` / `password`

Change these immediately in non-development environments.
