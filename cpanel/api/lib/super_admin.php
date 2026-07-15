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
 * Must never throw — a failed bootstrap must not take down login or the rest of the API.
 */
function ensure_default_super_admin(PDO $pdo): void {
  static $done = false;
  if ($done || !super_admin_bootstrap_enabled()) {
    return;
  }
  $done = true;

  try {
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
    if (!is_string($hash) || $hash === '') {
      return;
    }

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

      $id = (int)$row['id'];

      // Apply core fields first so a missing optional column cannot block promotion.
      try {
        $update = $pdo->prepare(
          "UPDATE users SET password_hash = ?, display_name = ?, role = 'super_admin' WHERE id = ?"
        );
        $update->execute([$hash, $displayName, $id]);
      } catch (Throwable $e) {
        error_log(sprintf('[turnout] ensure_default_super_admin core update: %s', $e->getMessage()));
        return;
      }

      foreach ([
        "UPDATE users SET is_blocked = 0 WHERE id = ?",
        "UPDATE users SET status = 'active' WHERE id = ?",
        "UPDATE users SET force_password_reset = 0 WHERE id = ?",
      ] as $sql) {
        try {
          $pdo->prepare($sql)->execute([$id]);
        } catch (Throwable $e) {
          // Optional columns may be absent on older schemas.
        }
      }
      try {
        mark_user_email_verified($pdo, $id);
      } catch (Throwable $e) {}
      return;
    }

    try {
      $insert = $pdo->prepare(
        "INSERT INTO users (email, password_hash, display_name, role, is_blocked, status, force_password_reset)
         VALUES (?, ?, 'Platform Admin', 'super_admin', 0, 'active', 0)"
      );
      $insert->execute([$email, $hash]);
    } catch (Throwable $e) {
      // Fall back to a minimal insert for older schemas missing optional columns.
      try {
        $insert = $pdo->prepare(
          "INSERT INTO users (email, password_hash, display_name, role)
           VALUES (?, ?, 'Platform Admin', 'super_admin')"
        );
        $insert->execute([$email, $hash]);
      } catch (Throwable $e2) {
        error_log(sprintf('[turnout] ensure_default_super_admin insert: %s', $e2->getMessage()));
      }
    }
    try {
      $idStmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
      $idStmt->execute([$email]);
      $created = $idStmt->fetch();
      if (is_array($created)) {
        mark_user_email_verified($pdo, (int)$created['id']);
      }
    } catch (Throwable $e) {}
  } catch (Throwable $e) {
    error_log(sprintf('[turnout] ensure_default_super_admin: %s', $e->getMessage()));
  }
}
