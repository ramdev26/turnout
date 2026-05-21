<?php

function auth_cookie_name(): string {
  $cfg = get_config();
  $s = $cfg['session'] ?? [];
  $baseName = (string)($s['name'] ?? 'turnout_sess');
  return $baseName . '_auth';
}

function auth_cookie_options(): array {
  $cfg = get_config();
  $s = $cfg['session'] ?? [];
  $samesite = (string)($s['cookie_samesite'] ?? 'Lax');
  if (!in_array($samesite, ['Lax', 'Strict', 'None'], true)) $samesite = 'Lax';
  return [
    'expires' => 0,
    'path' => '/',
    'secure' => (bool)($s['cookie_secure'] ?? false),
    'httponly' => (bool)($s['cookie_httponly'] ?? true),
    'samesite' => $samesite,
  ];
}

function auth_signing_key(): string {
  $cfg = get_config();
  $sessionCfg = $cfg['session'] ?? [];
  $explicitSecret = trim((string)($sessionCfg['token_secret'] ?? ''));
  if ($explicitSecret !== '') return $explicitSecret;

  // Deterministic fallback so serverless instances can verify each other's cookies.
  $db = $cfg['db'] ?? [];
  $parts = [
    (string)($db['host'] ?? ''),
    (string)($db['name'] ?? ''),
    (string)($db['user'] ?? ''),
    (string)($db['pass'] ?? ''),
  ];
  return hash('sha256', implode('|', $parts));
}

function b64url_encode(string $raw): string {
  return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
}

function b64url_decode(string $encoded): ?string {
  $normalized = strtr($encoded, '-_', '+/');
  $pad = strlen($normalized) % 4;
  if ($pad > 0) $normalized .= str_repeat('=', 4 - $pad);
  $decoded = base64_decode($normalized, true);
  if ($decoded === false) return null;
  return $decoded;
}

function issue_auth_cookie(int $userId): void {
  $now = time();
  $payload = [
    'uid' => $userId,
    'iat' => $now,
    'exp' => $now + (60 * 60 * 24 * 7), // 7 days
  ];
  $json = json_encode($payload, JSON_UNESCAPED_SLASHES);
  if (!is_string($json) || $json === '') return;
  $encoded = b64url_encode($json);
  $sig = hash_hmac('sha256', $encoded, auth_signing_key());
  $token = $encoded . '.' . $sig;
  $opts = auth_cookie_options();
  $opts['expires'] = $payload['exp'];
  setcookie(auth_cookie_name(), $token, $opts);
}

function clear_auth_cookie(): void {
  $opts = auth_cookie_options();
  $opts['expires'] = time() - 3600;
  setcookie(auth_cookie_name(), '', $opts);
}

function user_id_from_auth_cookie(): ?int {
  $token = trim((string)($_COOKIE[auth_cookie_name()] ?? ''));
  if ($token === '') return null;
  $parts = explode('.', $token, 2);
  if (count($parts) !== 2) return null;
  $encoded = $parts[0];
  $sig = strtolower($parts[1]);
  if ($encoded === '' || $sig === '') return null;

  $expectedSig = hash_hmac('sha256', $encoded, auth_signing_key());
  if (!hash_equals($expectedSig, $sig)) return null;

  $json = b64url_decode($encoded);
  if ($json === null) return null;
  $payload = json_decode($json, true);
  if (!is_array($payload)) return null;

  $uid = (int)($payload['uid'] ?? 0);
  $exp = (int)($payload['exp'] ?? 0);
  if ($uid <= 0 || $exp <= 0 || $exp < time()) return null;
  return $uid;
}

function start_app_session(): void {
  $cfg = get_config();
  $s = $cfg['session'] ?? [];

  $name = $s['name'] ?? 'turnout_sess';
  $secure = (bool)($s['cookie_secure'] ?? false);
  $httponly = (bool)($s['cookie_httponly'] ?? true);
  $samesite = $s['cookie_samesite'] ?? 'Lax';
  if (!in_array($samesite, ['Lax', 'Strict', 'None'], true)) $samesite = 'Lax';

  session_name($name);
  session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => $secure,
    'httponly' => $httponly,
    'samesite' => $samesite,
  ]);

  if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
  }
}

function current_user_id(): ?int {
  $id = $_SESSION['user_id'] ?? null;
  if ($id === null) {
    $cookieUid = user_id_from_auth_cookie();
    if ($cookieUid === null) return null;
    // Keep existing code paths working by hydrating current session.
    $_SESSION['user_id'] = $cookieUid;
    return $cookieUid;
  }
  $n = intval($id);
  return $n > 0 ? $n : null;
}

function require_user_id(): int {
  $uid = current_user_id();
  if ($uid === null) json_response(401, ['error' => 'unauthorized']);
  return $uid;
}

function regenerate_app_session(): void {
  if (session_status() !== PHP_SESSION_ACTIVE) return;
  session_regenerate_id(true);
}

function load_user_profile(int $userId): array {
  $stmt = db()->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
  $stmt->execute([$userId]);
  $row = $stmt->fetch();
  if (!$row) json_response(401, ['error' => 'unauthorized']);

  return [
    'uid' => (string)$row['id'],
    'email' => $row['email'],
    'displayName' => $row['display_name'],
    'role' => $row['role'],
    'isBlocked' => (int)($row['is_blocked'] ?? 0) === 1,
    'status' => (string)($row['status'] ?? 'active'),
    'forcePasswordReset' => (int)($row['force_password_reset'] ?? 0) === 1,
    'createdAt' => gmdate('c', strtotime($row['created_at'])),
  ];
}

