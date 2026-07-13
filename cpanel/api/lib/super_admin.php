<?php

function super_admin_bootstrap_enabled(): bool {
  $flag = strtolower(trim((string)(getenv('SUPER_ADMIN_BOOTSTRAP') ?: 'true')));
  return !in_array($flag, ['0', 'false', 'no', 'off'], true);
}

function super_admin_bootstrap_email(): string {
  return strtolower(trim((string)(getenv('SUPER_ADMIN_EMAIL') ?: 'admin@bigturnout.co')));
}

function super_admin_bootstrap_password(): string {
  return (string)(getenv('SUPER_ADMIN_PASSWORD') ?: 'BigTurnout@Admin2026!');
}

/**
 * Ensures the configured platform super-admin account exists and can sign in.
 * Updates role/password only when missing, wrong role, or password no longer matches bootstrap.
 */
function ensure_default_super_admin(PDO $pdo): void {
  static $done = false;
  if ($done || !super_admin_bootstrap_enabled()) {
    return;
  }
  $done = true;

  $email = super_admin_bootstrap_email();
  $password = super_admin_bootstrap_password();
  if ($email === '' || strlen($password) < 8) {
    return;
  }

  ensure_users_role_support($pdo);

  $forceReset = filter_var(getenv('SUPER_ADMIN_RESET_PASSWORD'), FILTER_VALIDATE_BOOLEAN);

  $stmt = $pdo->prepare('SELECT id, role, password_hash, display_name FROM users WHERE email = ? LIMIT 1');
  $stmt->execute([$email]);
  $row = $stmt->fetch();
  $hash = password_hash($password, PASSWORD_DEFAULT);

  if (is_array($row)) {
    $role = (string)($row['role'] ?? '');
    $passwordHash = (string)($row['password_hash'] ?? '');
    $needsUpdate = $role !== 'super_admin' || $forceReset;
    if (!$needsUpdate) {
      $needsUpdate = $passwordHash === '' || !password_verify($password, $passwordHash);
    }
    if (!$needsUpdate) {
      return;
    }

    $displayName = trim((string)($row['display_name'] ?? ''));
    if ($displayName === '') {
      $displayName = 'Platform Admin';
    }

    $update = $pdo->prepare(
      "UPDATE users
       SET password_hash = ?, display_name = ?, role = 'super_admin', is_blocked = 0, status = 'active', force_password_reset = 0
       WHERE id = ?"
    );
    $update->execute([$hash, $displayName, (int)$row['id']]);
    return;
  }

  $insert = $pdo->prepare(
    "INSERT INTO users (email, password_hash, display_name, role, is_blocked, status, force_password_reset)
     VALUES (?, ?, 'Platform Admin', 'super_admin', 0, 'active', 0)"
  );
  $insert->execute([$email, $hash]);
}
