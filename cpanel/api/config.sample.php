<?php
// Copy this file to config.php and fill in your DB credentials.
// On Vercel, config.php can read from environment variables (see repo config.php pattern).
// Do not commit config.php.

$env = static function (string $key, string $default = ''): string {
  $v = getenv($key);
  if ($v === false || $v === null) return $default;
  return trim((string)$v);
};

return [
  'app' => [
    'dev_mode' => strtolower($env('APP_DEV_MODE', 'true')) === 'true',
  ],
  'db' => [
    'driver' => $env('DB_DRIVER', 'sqlite'),
    'url' => $env('DATABASE_URL'),
    'host' => $env('DB_HOST', 'localhost'),
    'name' => $env('DB_NAME', 'cpanel_db_name'),
    'user' => $env('DB_USER', 'cpanel_db_user'),
    'pass' => $env('DB_PASS', 'cpanel_db_password'),
    'charset' => $env('DB_CHARSET', 'utf8mb4'),
    'path' => $env('DB_PATH', __DIR__ . '/data/dev.sqlite'),
  ],
  'payhere' => [
    'sandbox' => strtolower($env('PAYHERE_SANDBOX', 'true')) !== 'false',
    'merchant_id' => $env('PAYHERE_MERCHANT_ID', 'CHANGE_ME'),
    'merchant_secret' => $env('PAYHERE_MERCHANT_SECRET', 'CHANGE_ME'),
    'notify_url' => $env('PAYHERE_NOTIFY_URL', 'https://your-domain.example/api/payhere/notify'),
    'app_base_url' => $env('APP_BASE_URL', 'https://your-domain.example'),
  ],
  'session' => [
    'name' => $env('SESSION_NAME', 'turnout_sess'),
    'cookie_secure' => strtolower($env('SESSION_COOKIE_SECURE', 'false')) !== 'false',
    'cookie_httponly' => true,
    'cookie_samesite' => $env('SESSION_COOKIE_SAMESITE', 'Lax'),
    'token_secret' => $env('SESSION_TOKEN_SECRET', 'CHANGE_ME_LONG_RANDOM_SECRET'),
    'cookie_domain' => $env('SESSION_COOKIE_DOMAIN', ''),
  ],
  'mail' => [
    'enabled' => strtolower($env('MAIL_ENABLED', 'true')) === 'true',
    'from' => $env('MAIL_FROM', 'admin@bigturnout.co'),
    'from_name' => $env('MAIL_FROM_NAME', 'Turnout'),
    'smtp_host' => $env('MAIL_SMTP_HOST', ''),
    'smtp_port' => (int)$env('MAIL_SMTP_PORT', '587'),
    'smtp_user' => $env('MAIL_SMTP_USER', ''),
    'smtp_pass' => $env('MAIL_SMTP_PASS', ''),
    'smtp_secure' => $env('MAIL_SMTP_SECURE', 'tls'),
  ],
  'domains' => [
    'cname_target' => $env('CUSTOM_DOMAIN_CNAME_TARGET', 'cname.vercel-dns.com'),
    'apex_ip' => $env('CUSTOM_DOMAIN_APEX_IP', '76.76.21.21'),
    'platform_hosts' => $env('PLATFORM_HOSTS', 'localhost,127.0.0.1'),
  ],
];

