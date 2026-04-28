<?php
// Copy this file to config.php and fill in your DB credentials.
// Do not commit config.php.

return [
  'app' => [
    // Set to false in production
    'dev_mode' => true,
  ],
  'db' => [
    // mysql (cPanel) or sqlite (local dev)
    'driver' => 'mysql',
    'host' => 'localhost',
    'name' => 'cpanel_db_name',
    'user' => 'cpanel_db_user',
    'pass' => 'cpanel_db_password',
    'charset' => 'utf8mb4',
    // sqlite only:
    // 'path' => __DIR__ . '/data/dev.sqlite',
  ],
  'payhere' => [
    // Set true for sandbox testing
    'sandbox' => true,
    // Fill with your PayHere merchant credentials in local config.php
    'merchant_id' => 'CHANGE_ME',
    'merchant_secret' => 'CHANGE_ME',
    // Public webhook endpoint PayHere can call
    'notify_url' => 'https://your-domain.example/api/payhere/notify',
    // Frontend base URL for return/cancel redirects
    'app_base_url' => 'https://your-domain.example',
  ],
  'session' => [
    // Change this in production
    'name' => 'turnout_sess',
    // If your site is HTTPS, set to true
    'cookie_secure' => false,
    // Keep true to protect against JS access
    'cookie_httponly' => true,
    // SameSite Lax is fine for same-domain app + API
    'cookie_samesite' => 'Lax',
  ],
  'mail' => [
    // For cPanel, you can often use PHP mail() with a domain email configured.
    // Set enabled to false to disable sending.
    'enabled' => false,
    'from' => 'no-reply@example.com',
  ],
];

