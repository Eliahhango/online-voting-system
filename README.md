# Online Voting System

This project is organized into:
- `frontend/` static pages (public, voter, admin)
- `assets/` shared CSS/JS/images/icons
- `backend/` PHP API endpoints (auth, voter, admin)
- `database/` SQL schema + seed scripts
- `docs/` project documentation

## Backend Runtime Notes
- Default DB driver is SQLite (`database/app.sqlite`) via `backend/config/db.php`
- Database auto-initializes from `database/schema.sql` and `database/seed.sql` on first connection
- API uses session-based authentication and role checks (`admin`, `voter`)

## Development Seed Accounts
- Admin: `admin@ovs.local` / `password`
- Voter: `voter@ovs.local` / `password`

Update credentials and environment settings before deployment.
