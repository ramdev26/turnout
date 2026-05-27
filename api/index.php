<?php

const TURNOUT_API_BRIDGE_VERSION = '2026-05-27-auth-bridge-v1';

if (isset($_GET['turnout_api_version'])) {
  header('Content-Type: application/json; charset=utf-8');
  header('X-Turnout-Bridge: ' . TURNOUT_API_BRIDGE_VERSION);
  echo json_encode(['bridge' => TURNOUT_API_BRIDGE_VERSION]);
  exit;
}

// Vercel PHP runtimes often strip Authorization before it reaches $_SERVER.
if (!isset($_SERVER['HTTP_AUTHORIZATION']) || trim((string)$_SERVER['HTTP_AUTHORIZATION']) === '') {
  if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
    $_SERVER['HTTP_AUTHORIZATION'] = (string)$_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
  } elseif (function_exists('getallheaders')) {
    $headers = getallheaders();
    if (is_array($headers)) {
      foreach ($headers as $name => $value) {
        if (strcasecmp((string)$name, 'Authorization') === 0) {
          $_SERVER['HTTP_AUTHORIZATION'] = (string)$value;
          break;
        }
      }
    }
  }
}

// Vercel /api bridge: route all /api/* requests into the existing PHP API app.
require __DIR__ . '/../cpanel/api/index.php';

