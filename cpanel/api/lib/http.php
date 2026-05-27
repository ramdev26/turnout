<?php

function request_id(): string {
  static $id = null;
  if ($id !== null) {
    return $id;
  }
  $incoming = trim((string)($_SERVER['HTTP_X_REQUEST_ID'] ?? ''));
  if ($incoming !== '') {
    $id = preg_replace('/[^a-zA-Z0-9\-_]/', '', $incoming) ?: bin2hex(random_bytes(8));
    return $id;
  }
  $id = bin2hex(random_bytes(8));
  return $id;
}

function is_debug_mode_enabled(): bool {
  $debug = strtolower(trim((string)(getenv('APP_DEBUG') ?: '')));
  return in_array($debug, ['1', 'true', 'yes', 'on'], true);
}

function init_runtime_error_handling(): void {
  header('X-Request-Id: ' . request_id());
  ini_set('display_errors', '0');
  error_reporting(E_ALL);

  set_exception_handler(function (Throwable $e): void {
    error_log(sprintf('[turnout][%s] %s in %s:%d', request_id(), $e->getMessage(), $e->getFile(), $e->getLine()));
    $payload = [
      'error' => 'internal_server_error',
      'requestId' => request_id(),
      'message' => 'An unexpected server error occurred.',
    ];
    if (is_debug_mode_enabled()) {
      $payload['debug'] = $e->getMessage();
    }
    json_response(500, $payload);
  });

  set_error_handler(function (int $severity, string $message, string $file, int $line): bool {
    if (!(error_reporting() & $severity)) {
      return false;
    }
    throw new ErrorException($message, 0, $severity, $file, $line);
  });
}

function json_response(int $status, $data): void {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store, max-age=0');
  header('X-Request-Id: ' . request_id());
  echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  exit;
}

function read_json_body(): array {
  $raw = file_get_contents('php://input');
  if ($raw === false || $raw === '') {
    return [];
  }
  $decoded = json_decode($raw, true);
  if (!is_array($decoded)) {
    json_response(400, ['error' => 'invalid_json']);
  }
  return $decoded;
}

function require_method(string $method): void {
  if (strtoupper($_SERVER['REQUEST_METHOD'] ?? '') !== strtoupper($method)) {
    json_response(405, ['error' => 'method_not_allowed']);
  }
}

function get_path(): string {
  $uri = $_SERVER['REQUEST_URI'] ?? '/';
  $path = parse_url($uri, PHP_URL_PATH);
  if (!is_string($path)) {
    return '/';
  }
  return rtrim($path, '/');
}

function configured_app_hosts(): array {
  $hosts = [];
  $cfg = get_config();
  $appBase = trim((string)(($cfg['payhere'] ?? [])['app_base_url'] ?? ''));
  if ($appBase !== '') {
    $h = strtolower((string)(parse_url($appBase, PHP_URL_HOST) ?? ''));
    if ($h !== '') {
      $hosts[] = $h;
    }
  }
  $extra = trim((string)(getenv('ALLOWED_ORIGINS') ?: ''));
  if ($extra !== '') {
    foreach (explode(',', $extra) as $part) {
      $part = trim($part);
      if ($part === '') {
        continue;
      }
      $h = strtolower((string)(parse_url($part, PHP_URL_HOST) ?: $part));
      if ($h !== '') {
        $hosts[] = $h;
      }
    }
  }
  $platform = trim((string)(($cfg['domains'] ?? [])['platform_hosts'] ?? ''));
  if ($platform !== '') {
    foreach (explode(',', $platform) as $part) {
      $part = strtolower(trim($part));
      if ($part !== '') {
        $hosts[] = $part;
      }
    }
  }
  return array_values(array_unique($hosts));
}

function is_trusted_origin_request(): bool {
  $origin = trim((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
  $referer = trim((string)($_SERVER['HTTP_REFERER'] ?? ''));
  $host = trim((string)($_SERVER['HTTP_HOST'] ?? ''));
  if ($host === '') {
    return false;
  }

  $hostOnly = strtolower((string)explode(':', $host)[0]);
  $originHost = $origin !== '' ? strtolower((string)(parse_url($origin, PHP_URL_HOST) ?? '')) : '';
  $refererHost = $referer !== '' ? strtolower((string)(parse_url($referer, PHP_URL_HOST) ?? '')) : '';
  $allowed = configured_app_hosts();

  $isPrivateOrLoopback = static function (string $value): bool {
    if ($value === '') {
      return false;
    }
    if ($value === 'localhost' || $value === '::1') {
      return true;
    }
    if (!filter_var($value, FILTER_VALIDATE_IP)) {
      return false;
    }
    if (str_starts_with($value, '10.')) {
      return true;
    }
    if (str_starts_with($value, '192.168.')) {
      return true;
    }
    if (preg_match('/^172\.(1[6-9]|2[0-9]|3[0-1])\./', $value)) {
      return true;
    }
    return str_starts_with($value, '127.');
  };

  $localAliases = ['localhost', '127.0.0.1', '::1'];
  $hostIsLocal = in_array($hostOnly, $localAliases, true);
  $originIsLocal = in_array($originHost, $localAliases, true);
  $refererIsLocal = in_array($refererHost, $localAliases, true);
  if ($hostIsLocal && ($originIsLocal || $refererIsLocal)) {
    return true;
  }

  if ($hostIsLocal) {
    $cfg = get_config();
    $devMode = (bool)(($cfg['app'] ?? [])['dev_mode'] ?? false);
    if ($devMode && ($isPrivateOrLoopback($originHost) || $isPrivateOrLoopback($refererHost))) {
      return true;
    }
  }

  if ($originHost !== '' && ($originHost === $hostOnly || in_array($originHost, $allowed, true))) {
    return true;
  }
  if ($originHost === '' && $refererHost !== '' && ($refererHost === $hostOnly || in_array($refererHost, $allowed, true))) {
    return true;
  }
  return false;
}

function set_cors_headers_for_same_domain(): void {
  $origin = trim((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
  $host = strtolower((string)explode(':', trim((string)($_SERVER['HTTP_HOST'] ?? '')))[0]);
  $allowed = configured_app_hosts();
  if ($host !== '') {
    $allowed[] = $host;
  }
  $allowed = array_values(array_unique(array_filter($allowed)));

  if ($origin !== '') {
    $originHost = strtolower((string)(parse_url($origin, PHP_URL_HOST) ?? ''));
    if ($originHost !== '' && (in_array($originHost, $allowed, true) || $originHost === $host)) {
      header('Access-Control-Allow-Origin: ' . $origin);
      header('Access-Control-Allow-Credentials: true');
      header('Vary: Origin');
      header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
      header('Access-Control-Allow-Headers: Content-Type, Accept, Authorization, X-Request-Id');
      header('Access-Control-Max-Age: 86400');
    }
  }
}

init_runtime_error_handling();
