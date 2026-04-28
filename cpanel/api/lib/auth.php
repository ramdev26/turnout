<?php

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
  if ($id === null) return null;
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

