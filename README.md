# Turnout (cPanel + PHP + React)

Turnout is a Vite + React frontend with a PHP backend designed for cPanel hosting.

## Recent production hardening updates

- Added stable Vercel routing for SPA + PHP API (`/api/*` no longer falls through to SPA).
- Added production-safe server error handling with request IDs in API responses.
- Added API request timeout and safer client-side error normalization.
- Added PostgreSQL compatibility path for serverless deployments.
- Reduced repeated backend schema/bootstrap checks per request to improve latency.
- Improved auth/loading UX so protected routes show a loader instead of a blank screen.

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

For API runtime configuration, set environment variables in your host (Vercel/cPanel):

- `APP_DEBUG=false` (recommended for production)
- `SESSION_TOKEN_SECRET=<long-random-secret>`
- `DATABASE_URL=<postgres://...>` **or** MySQL variables (`DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`)
- `BLOB_READ_WRITE_TOKEN=<token>` (required on Vercel for durable banner uploads in Create Event)

To enable banner uploads on Vercel:

1. In your Vercel project, open **Storage** and create a **Blob** store (or connect an existing one).
2. Ensure `BLOB_READ_WRITE_TOKEN` is added to Production (and Preview if needed).
3. Redeploy so the PHP API can upload to Blob and return a public `bannerUrl`.

Local PHP dev can store banners under `cpanel/api/uploads/banners/` without Blob.

If frontend and API are on separate domains, set:

- `VITE_API_BASE_URL=https://your-api-domain.example`

If this is not set, production frontend requests default to relative `/api/*` URLs on the Vercel domain.

### 4) Deploy

- Trigger deployment in Vercel
- Verify routes like `/dashboard`, `/events/:eventId`, `/attendee/dashboard` load directly (SPA fallback)
- Verify login, event creation, checkout, and any API-backed pages

## Custom domains (per event)

Organizers can connect a domain like `events.yourbrand.com` to a published event from **Dashboard → Event settings → Custom domain**.

### How it works

1. Organizer saves the domain in Turnout (stored on the event + DNS instructions).
2. Organizer adds DNS at their registrar (CNAME to `cname.vercel-dns.com`, or A record for apex).
3. Domain is added to the Vercel project (automatic if API token is set, or manually in Vercel dashboard).
4. Edge `middleware.ts` maps the custom host to `/e/{slug}` so the themed landing page loads on the custom URL.

### Vercel environment variables

| Variable | Purpose |
|----------|---------|
| `CUSTOM_DOMAIN_CNAME_TARGET` | CNAME value shown to users (default `cname.vercel-dns.com`) |
| `CUSTOM_DOMAIN_APEX_IP` | A record for root domains (default `76.76.21.21`) |
| `PLATFORM_HOSTS` | Comma-separated hosts that are NOT custom domains |
| `VERCEL_API_TOKEN` | Auto-register domains on the Vercel project |
| `VERCEL_PROJECT_ID` | Vercel project ID |
| `VERCEL_TEAM_ID` | Optional team scope |

### API endpoints

- `GET /api/domain/config` — public DNS targets
- `GET /api/events/by-host/{hostname}` — resolve host → slug (middleware)
- `GET/POST/DELETE /api/events/{id}/domain` — organizer domain management
- `POST /api/events/{id}/domain/verify` — check DNS / Vercel verification

### Notes

- [`public/.htaccess`](public/.htaccess) is for Apache/cPanel only; Vercel uses [`vercel.json`](vercel.json) rewrites.
- If your API uses cookies/sessions, ensure API CORS allows your Vercel frontend origin and credentials.

## PayHere setup (dashboard)

PayHere uses the **JavaScript SDK** (onsite popup checkout). You can configure credentials without redeploying:

1. Sign in as a super admin and open **Admin → System Settings**.
2. Enter your **PayHere Merchant ID** and the **Merchant Secret** generated for your domain (PayHere → Integrations → Add Domain/App).
3. Choose **Sandbox** (testing) or **Live** (production) and **Save**.

The server generates the payment `hash` securely, and the return/cancel/`notify_url` are derived automatically from the current domain (`/api/payhere/notify`). PayHere notifications are verified server-side with the `md5sig` checksum before an order is marked paid.

Credentials set in System Settings take priority; otherwise the API falls back to the `PAYHERE_*` environment variables.

## PayHere callback check

After deployment, verify PayHere callback URL is reachable:
- `https://your-domain.example/api/payhere/notify`

Then test full flow:
1. Register/Login
2. Create Event + publish
3. Checkout
4. Complete PayHere payment
5. Confirm order status changes to `paid` and attendee records are created
