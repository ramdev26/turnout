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

- Sandbox PayHere credentials live in `config.vercel.php` for testing; use `PAYHERE_*` env vars for live production secrets (do not commit live keys).
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

### Plunk (transactional email)

Ticket purchase confirmations and other app emails are sent through [Plunk](https://www.useplunk.com) when configured.

Set in the project `.env` (loaded by the PHP API) or in Vercel **Environment Variables**:

- `PLUNK_SECRET_KEY` — secret API key from the Plunk dashboard
- `PLUNK_API_URL` — optional, defaults to `https://next-api.useplunk.com/v1/send`
- `MAIL_ENABLED` — `true` (default) to send mail; `false` to no-op (dev)
- `MAIL_FROM` — sender address verified in Plunk (e.g. `admin@bigturnout.co`)
- `MAIL_FROM_NAME` — display name (e.g. `Turnout`)

Verify your sending domain in Plunk before going live. After deploy, complete a test checkout to confirm the buyer receives the confirmation email.

### Google Places (event location autocomplete)

Set in Vercel and local `.env.local`:

- `VITE_GOOGLE_MAPS_API_KEY` — browser API key with **Maps JavaScript API** and **Places API** enabled

In [Google Cloud Console](https://console.cloud.google.com/google/maps-apis), create a key, enable those APIs, and restrict it to your site hostnames (HTTP referrer), for example `https://your-app.vercel.app/*` and `http://localhost:*`. Redeploy after adding the variable.

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

## PayHere setup

Turnout implements the official **PayHere JavaScript SDK** ([docs](https://support.payhere.lk/api-&-mobile-sdk/javascript-sdk)): PHP builds the signed payment object (`/api/payhere/initiate`), the browser loads `https://www.payhere.lk/lib/payhere.js` and calls `payhere.startPayment()` with `sandbox: true` for sandbox payments (the sandbox host does not serve `/lib/payhere.js`), and PayHere callbacks hit `/api/payhere/notify`.

### Credentials

Sandbox defaults live in [`cpanel/api/config.vercel.php`](cpanel/api/config.vercel.php) (currently merchant `1236076`). Override with `PAYHERE_MERCHANT_ID`, `PAYHERE_MERCHANT_SECRET`, and `PAYHERE_SANDBOX` on Vercel for production.

In PayHere sandbox: **Settings → Domains & Credentials** → add your site host (e.g. `turnout-omega.vercel.app`, not `https://`) → wait for approval → copy the **Merchant Secret for that domain**. Secrets are per domain; a secret for `localhost` will not work on Vercel.

### Action URLs

| Mode | Checkout URL |
|------|----------------|
| Sandbox | `https://sandbox.payhere.lk/pay/checkout` |
| Live | `https://www.payhere.lk/pay/checkout` |

The form `action` is `https://sandbox.payhere.lk/pay/checkout` (sandbox) or `https://www.payhere.lk/pay/checkout` (live).

### Required checkout fields

Our server sends all mandatory fields (including `hash`):

`merchant_id`, `return_url`, `cancel_url`, `notify_url`, `order_id`, `items`, `currency`, `amount`, `hash`, `first_name`, `last_name`, `email`, `phone`, `address`, `city`, `country`

`hash` is generated server-side: `UPPER(MD5(merchantId + orderId + amount + currency + UPPER(MD5(merchantSecret))))` with `amount` like `1500.00`.

### Notify URL (HTTPS required)

PayHere posts payment status to:

`https://your-domain.example/api/payhere/notify`

**Must be HTTPS on a public host.** PayHere does not send `notify_url` callbacks to plain `http://` (local `127.0.0.1` only works with a tunnel such as ngrok pointing at your API). Orders are marked **paid** only after `md5sig` verification (`status_code == 2`).

### Return flow (like a `/check` route)

After checkout, the customer hits `/payhere/return`, which polls `/api/orders/:id` until the notify handler has confirmed payment—same idea as posting to a `/check` endpoint in Node samples.

### Sandbox test cards

| Brand | Number |
|-------|--------|
| Visa | `4916217501611292` |
| MasterCard | `5307732125531191` |
| AMEX | `346781005510225` |

Use any valid name, CVV, and expiry. Any other card number simulates failure.

### End-to-end test

1. Register / log in, create and publish an event with a paid ticket.
2. Checkout on your **deployed HTTPS** domain (promote latest Vercel build).
3. Pay with a sandbox test card above.
4. Confirm order status becomes `paid` and attendees are created.

### Troubleshooting: "Unauthorized payment request"

PayHere shows this when the **Merchant Secret does not match** your Merchant ID and the **approved domain** on the return/notify URLs—not when Rs. 43,000 vs Rs. 10 is wrong.

1. Log in to [sandbox.payhere.lk](https://sandbox.payhere.lk) → **Integrations** (or Settings → Domains & Credentials).
2. Add **`turnout-omega.vercel.app`** (host only, no `https://`) and wait until **Approved**.
3. Copy the **Merchant Secret shown for that domain** (not an old secret from another domain).
4. Set it in Vercel: `PAYHERE_MERCHANT_ID=1236076`, `PAYHERE_MERCHANT_SECRET=<paste exactly as PayHere shows>`, or update `cpanel/api/config.vercel.php` and remove conflicting env vars. The merchant ID must match the account that issued the secret.
5. As super admin, call `GET /api/admin/payhere/check` — response `accepted: true` means PayHere accepts your credentials.

Ensure `APP_BASE_URL` / `payhere.app_base_url` matches the domain you approved in PayHere.
