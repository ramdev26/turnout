<?php
// Vercel config: PayHere sandbox defaults for testing; override with PAYHERE_* env for production.

$env = static function (string $key, string $default = ''): string {
  $v = getenv($key);
  if ($v === false || $v === null) return $default;
  return trim((string)$v);
};

/**
 * Prefer direct/session Postgres URLs for PHP PDO.
 * Supabase transaction-pooler URLs (port 6543 + pgbouncer=true) break prepared statements.
 */
$dbUrl =
  $env('TURN_POSTGRES_URL_NON_POOLING') ?:
  $env('TURN_DATABASE_URL') ?:
  $env('TURN_POSTGRES_URL') ?:
  $env('TURN_POSTGRES_PRISMA_URL') ?:
  $env('TURNOUT_DATABASE_URL') ?:
  $env('TURNOUT_POSTGRES_URL') ?:
  $env('TURNOUT_PRISMA_DATABASE_URL') ?:
  $env('DATABASE_URL') ?:
  $env('POSTGRES_URL_NON_POOLING') ?:
  $env('POSTGRES_URL') ?:
  $env('POSTGRES_PRISMA_URL') ?:
  $env('PRISMA_DATABASE_URL');

// Build from discrete Supabase/Vercel TURN_* pieces when no URL is present.
if ($dbUrl === '') {
  $host = $env('TURN_POSTGRES_HOST') ?: $env('DB_HOST');
  $name = $env('TURN_POSTGRES_DATABASE') ?: $env('DB_NAME') ?: 'postgres';
  $user = $env('TURN_POSTGRES_USER') ?: $env('DB_USER');
  $pass = $env('TURN_POSTGRES_PASSWORD') ?: $env('DB_PASS');
  if ($host !== '' && $user !== '' && $pass !== '') {
    $dbUrl = sprintf(
      'postgresql://%s:%s@%s:5432/%s?sslmode=require',
      rawurlencode($user),
      rawurlencode($pass),
      $host,
      rawurlencode($name)
    );
  }
}

// If only a Supabase transaction pooler URL is available, rewrite to session mode (5432).
if ($dbUrl !== '' && (str_contains($dbUrl, ':6543/') || str_contains($dbUrl, 'pgbouncer=true'))) {
  $dbUrl = preg_replace('#:6543/#', ':5432/', $dbUrl) ?? $dbUrl;
  $dbUrl = str_replace(['pgbouncer=true&', '&pgbouncer=true', 'pgbouncer=true'], '', $dbUrl);
  $dbUrl = str_replace(['?&', '&&'], ['?', '&'], $dbUrl);
  $dbUrl = rtrim($dbUrl, '?&');
}

$dbDriver = strtolower($env('DB_DRIVER'));
if ($dbDriver === '') {
  if (str_starts_with($dbUrl, 'postgres://') || str_starts_with($dbUrl, 'postgresql://')) {
    $dbDriver = 'pgsql';
  } else {
    $dbDriver = 'mysql';
  }
}

return [
  'app' => [
    'dev_mode' => false,
  ],
  'db' => [
    'driver' => $dbDriver,
    'url' => $dbUrl,
    'host' => $env('DB_HOST', 'localhost'),
    'name' => $env('DB_NAME'),
    'user' => $env('DB_USER'),
    'pass' => $env('DB_PASS'),
    'charset' => $env('DB_CHARSET', 'UTF8'),
  ],
  'payhere' => [
    'sandbox' => strtolower($env('PAYHERE_SANDBOX', 'true')) !== 'false',
    'merchant_id' => $env('PAYHERE_MERCHANT_ID', '1236076'),
    'merchant_secret' => $env('PAYHERE_MERCHANT_SECRET', 'MTk2NDI5Nzk5MzI3MzcwODk4NDkzNDA5OTcxNjMyMjgwODMxMjIyNQ=='),
    'notify_url' => $env('PAYHERE_NOTIFY_URL', 'https://app.bigturnout.co/api/payhere/notify'),
    'app_base_url' => $env('APP_BASE_URL', 'https://app.bigturnout.co'),
  ],
  'session' => [
    'name' => $env('SESSION_NAME', 'turnout_sess'),
    'cookie_secure' => strtolower($env('SESSION_COOKIE_SECURE', 'true')) !== 'false',
    'cookie_httponly' => strtolower($env('SESSION_COOKIE_HTTPONLY', 'true')) !== 'false',
    'cookie_samesite' => $env('SESSION_COOKIE_SAMESITE', 'Lax'),
    'token_secret' => $env('SESSION_TOKEN_SECRET', ''),
    'cookie_domain' => $env('SESSION_COOKIE_DOMAIN', ''),
  ],
  'super_admin' => [
    'email' => $env('SUPER_ADMIN_EMAIL', 'admin@bigturnout.co'),
    'password' => $env('SUPER_ADMIN_PASSWORD', 'BigTurnout@Admin2026!'),
    'bootstrap' => strtolower($env('SUPER_ADMIN_BOOTSTRAP', 'true')) !== 'false',
  ],
  'mail' => [
    'enabled' => strtolower($env('MAIL_ENABLED', 'true')) === 'true',
    'from' => $env('MAIL_FROM', 'admin@bigturnout.co'),
    'from_name' => $env('MAIL_FROM_NAME', 'Turnout'),
    'plunk_secret_key' => $env('PLUNK_SECRET_KEY', ''),
    'plunk_api_url' => $env('PLUNK_API_URL', 'https://next-api.useplunk.com/v1/send'),
    'smtp_host' => $env('MAIL_SMTP_HOST', ''),
    'smtp_port' => (int)$env('MAIL_SMTP_PORT', '587'),
    'smtp_user' => $env('MAIL_SMTP_USER', ''),
    'smtp_pass' => $env('MAIL_SMTP_PASS', ''),
    'smtp_secure' => $env('MAIL_SMTP_SECURE', 'tls'),
  ],
  'domains' => [
    'cname_target' => $env('CUSTOM_DOMAIN_CNAME_TARGET', 'cname.vercel-dns.com'),
    'apex_ip' => $env('CUSTOM_DOMAIN_APEX_IP', '76.76.21.21'),
    'platform_hosts' => $env('PLATFORM_HOSTS', 'app.bigturnout.co,turnout-omega.vercel.app,localhost,127.0.0.1'),
  ],
];
