<?php
// Router for PHP built-in server:
// php -S 127.0.0.1:8080 router.php
// It serves static files if they exist, otherwise routes to index.php.

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
if (is_string($path)) {
  $full = __DIR__ . $path;
  if ($path !== '/' && file_exists($full) && !is_dir($full)) {
    return false;
  }
}

require __DIR__ . '/index.php';

