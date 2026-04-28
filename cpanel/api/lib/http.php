<?php

function json_response(int $status, $data): void {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store, max-age=0');
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

