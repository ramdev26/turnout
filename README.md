# Turnout (cPanel + PHP + React)

Turnout is a Vite + React frontend with a PHP backend designed for cPanel hosting.

## Current baseline

- Local dev DB baseline: **SQLite**
- Production target: **MySQL on cPanel**
- Payment gateway: **PayHere**

## Local development (frontend)

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

The dev server runs on `http://localhost:3000/` (or next available port).

## Local development (PHP API)

1. Install PHP locally (recommended: XAMPP/WAMP, or any PHP 8+).
2. Copy [`cpanel/api/config.sample.php`](cpanel/api/config.sample.php) to `cpanel/api/config.php`.
3. For easiest local testing, use SQLite:
   - set `db.driver` to `sqlite`
   - optionally set `db.path` (default is `cpanel/api/data/dev.sqlite`)
   - schema auto-creates from [`cpanel/schema.sqlite.sql`](cpanel/schema.sqlite.sql)
4. Run the PHP API server:
   `php -S 127.0.0.1:8000 -t cpanel cpanel/api/index.php`

Vite is configured to proxy `/api/*` to `http://127.0.0.1:8000` during development.

### Demo login (local only)

On the `/login` page, click **Create demo organizer login (local dev)**. It creates:
`demo@turnout.local` / `Password123!`
and you can sign in with it.

This endpoint is intentionally restricted to localhost + dev mode.

## Security/config notes

- Never commit real PayHere secrets in `cpanel/api/config.php`.
- Keep `app.dev_mode = false` in production.
- Set session cookie security for production:
  - `cookie_secure = true`
  - `cookie_samesite = Lax` (or stricter based on your setup)

## cPanel deployment (frontend + API)

### 1) Create MySQL DB

- Create a MySQL database + user in cPanel
- Import [`cpanel/schema.sql`](cpanel/schema.sql) in phpMyAdmin

### 2) Deploy the PHP API

- Upload the contents of [`cpanel/api/`](cpanel/api/) to `public_html/api/`
- Copy `public_html/api/config.sample.php` to `public_html/api/config.php`
- Update:
  - `db.driver = mysql`
  - cPanel DB credentials
  - `payhere.*` values (`merchant_id`, `merchant_secret`, `notify_url`, `app_base_url`)
  - `app.dev_mode = false`
  - `session.cookie_secure = true` on HTTPS

### 3) Deploy the frontend

1. Build:
   `npm run build`
2. Upload the contents of `dist/` to `public_html/`
3. Also copy [`public/.htaccess`](public/.htaccess) to `public_html/.htaccess` for SPA route fallback.

The frontend expects the API at the same domain under `/api/*`.

## Vercel deployment (frontend)

This project can be deployed to Vercel as a Vite SPA using the included [`vercel.json`](vercel.json).

### 1) Push project to GitHub

- Commit your changes
- Push to a GitHub repository

### 2) Import to Vercel

- In Vercel, click **Add New... -> Project**
- Import your GitHub repository
- Framework preset: **Vite** (auto-detected)

### 3) Set environment variables

Because your backend is PHP-based (from `cpanel/api`), host the API separately (for example cPanel) and set:

- `VITE_API_BASE_URL=https://your-api-domain.example`

If this is not set, production frontend requests default to relative `/api/*` URLs on the Vercel domain.

### 4) Deploy

- Trigger deployment in Vercel
- Verify routes like `/dashboard`, `/events/:eventId`, `/attendee/dashboard` load directly (SPA fallback)
- Verify login, event creation, checkout, and any API-backed pages

### Notes

- [`public/.htaccess`](public/.htaccess) is for Apache/cPanel only; Vercel uses [`vercel.json`](vercel.json) rewrites.
- If your API uses cookies/sessions, ensure API CORS allows your Vercel frontend origin and credentials.

## PayHere callback check

After deployment, verify PayHere callback URL is reachable:
- `https://your-domain.example/api/payhere/notify`

Then test full flow:
1. Register/Login
2. Create Event + publish
3. Checkout
4. Complete PayHere payment
5. Confirm order status changes to `paid` and attendee records are created
