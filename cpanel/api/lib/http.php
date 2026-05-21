<?php

function request_id(): string {
  static $id = null;
  if ($id !== null) return $id;
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
  if (!is_string($path)) return '/';
  return rtrim($path, '/');
}

function set_cors_headers_for_same_domain(): void {
  // With same-domain hosting, we intentionally do not set Access-Control-Allow-Origin.
  // The React app will call /api/* on the same origin.
}

init_runtime_error_handling();

