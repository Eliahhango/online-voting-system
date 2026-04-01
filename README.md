# Online Voting System

This project is a complete web-based voting platform with three parts:
- public pages for general users,
- a voter portal for casting ballots,
- an admin portal for election management and reporting.

It is built with plain HTML/CSS/JavaScript on the frontend and PHP APIs on the backend.

## What is inside

- `index.html`
  Root entry page. It redirects to `frontend/index.html`.
- `frontend/`
  All UI pages (public, voter, admin).
- `assets/`
  Shared CSS and JavaScript.
- `backend/`
  PHP endpoints for authentication, voter actions, and admin actions.
- `database/`
  SQL schema/seed files and SQLite database file.
- `docs/`
  Project notes and documentation.

## Local setup (XAMPP)

1. Place the project in `C:\xampp\htdocs\online-voting-system`.
2. Start Apache from XAMPP.
3. Open one of these URLs:
   - `http://localhost/online-voting-system/`
   - `http://localhost/online-voting-system/frontend/index.html`

## Default development accounts

- Admin
  - Email: `admin@ovs.local`
  - Password: `password`
- Voter
  - Email: `voter@ovs.local`
  - Password: `password`

## Database behavior

- Default DB driver is SQLite (`database/app.sqlite`).
- On first backend call, the app auto-loads:
  - `database/schema.sql`
  - `database/seed.sql`
- MySQL is also supported through environment variables in `backend/config/config.php`.

## Security and access

- Session-based authentication is used.
- Role checks are enforced for voter/admin pages and APIs.
- Voting endpoints include checks to prevent duplicate ballot submission per election.

## Deployment notes

- Keep root `index.html` at project root to simplify deployment on shared hosts.
- Replace development credentials before production use.
- Review CORS/session settings in `backend/config/config.php` for your live domain.
