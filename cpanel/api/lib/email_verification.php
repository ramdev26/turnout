<?php

/**
 * Ensure users.email_verified_at exists.
 * Existing accounts are backfilled as verified so login is not broken.
 * New signups leave the column NULL until they confirm email.
 */
function ensure_email_verification_support(PDO $pdo): void {
  static $checked = false;
  if ($checked) return;

  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  try {
    $added = false;
    if ($driver === 'pgsql') {
      $has = $pdo->query(
        "SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'email_verified_at'
         LIMIT 1"
      );
      if (!$has || !$has->fetch()) {
        $pdo->exec('ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP NULL');
        $added = true;
      }
    } elseif ($driver === 'sqlite') {
      $cols = $pdo->query('PRAGMA table_info(users)')->fetchAll(PDO::FETCH_ASSOC);
      $exists = false;
      foreach ($cols as $c) {
        if (($c['name'] ?? '') === 'email_verified_at') {
          $exists = true;
          break;
        }
      }
      if (!$exists) {
        $pdo->exec('ALTER TABLE users ADD COLUMN email_verified_at TEXT NULL');
        $added = true;
      }
    } else {
      $stmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'email_verified_at'");
      if (!$stmt || !$stmt->fetch()) {
        $pdo->exec('ALTER TABLE users ADD COLUMN email_verified_at DATETIME NULL');
        $added = true;
      }
    }

    if ($added) {
      // One-time backfill: treat all pre-existing accounts as already verified.
      try {
        if ($driver === 'pgsql') {
          $pdo->exec('UPDATE users SET email_verified_at = COALESCE(created_at, CURRENT_TIMESTAMP) WHERE email_verified_at IS NULL');
        } elseif ($driver === 'sqlite') {
          $pdo->exec("UPDATE users SET email_verified_at = COALESCE(created_at, datetime('now')) WHERE email_verified_at IS NULL");
        } else {
          $pdo->exec('UPDATE users SET email_verified_at = COALESCE(created_at, NOW()) WHERE email_verified_at IS NULL');
        }
      } catch (Throwable $e) {
        error_log('[turnout] email_verified_at backfill: ' . $e->getMessage());
      }
    }
  } catch (Throwable $e) {
    error_log('[turnout] ensure_email_verification_support: ' . $e->getMessage());
  }

  $checked = true;
}

function user_email_is_verified(array $row): bool {
  $raw = $row['email_verified_at'] ?? null;
  if ($raw === null) return false;
  $s = trim((string)$raw);
  return $s !== '' && $s !== '0000-00-00 00:00:00';
}

function mark_user_email_verified(PDO $pdo, int $userId): void {
  if ($userId <= 0) return;
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  if ($driver === 'sqlite') {
    $pdo->prepare("UPDATE users SET email_verified_at = datetime('now') WHERE id = ? AND email_verified_at IS NULL")->execute([$userId]);
    return;
  }
  $pdo->prepare('UPDATE users SET email_verified_at = CURRENT_TIMESTAMP WHERE id = ? AND email_verified_at IS NULL')->execute([$userId]);
}

/**
 * Super-admin override: mark email verified even when the user never clicked the link.
 * Used when busy organizers cannot access OTP / verification email.
 */
function admin_force_verify_user_email(PDO $pdo, int $userId): bool {
  if ($userId <= 0) return false;
  ensure_email_verification_support($pdo);
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  if ($driver === 'sqlite') {
    $stmt = $pdo->prepare("UPDATE users SET email_verified_at = datetime('now') WHERE id = ?");
  } else {
    $stmt = $pdo->prepare('UPDATE users SET email_verified_at = CURRENT_TIMESTAMP WHERE id = ?');
  }
  $stmt->execute([$userId]);
  return $stmt->rowCount() > 0 || user_row_email_verified($pdo, $userId);
}

function user_row_email_verified(PDO $pdo, int $userId): bool {
  $stmt = $pdo->prepare('SELECT email_verified_at FROM users WHERE id = ? LIMIT 1');
  $stmt->execute([$userId]);
  $row = $stmt->fetch();
  return is_array($row) && user_email_is_verified($row);
}

/**
 * Create account + send verification email. Does not start a session.
 *
 * @return array{userId:int,emailSent:bool}
 */
function register_user_pending_verification(
  PDO $pdo,
  string $email,
  string $passwordHash,
  string $displayName,
  string $role
): array {
  ensure_email_verification_support($pdo);

  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  if ($driver === 'pgsql') {
    $ins = $pdo->prepare(
      'INSERT INTO users (email, password_hash, display_name, role, email_verified_at)
       VALUES (?, ?, ?, ?, NULL)
       RETURNING id'
    );
    $ins->execute([$email, $passwordHash, $displayName, $role]);
    $userId = (int)($ins->fetchColumn() ?: 0);
  } else {
    $ins = $pdo->prepare(
      'INSERT INTO users (email, password_hash, display_name, role, email_verified_at)
       VALUES (?, ?, ?, ?, NULL)'
    );
    $ins->execute([$email, $passwordHash, $displayName, $role]);
    $userId = (int)$pdo->lastInsertId();
  }

  if ($userId <= 0) {
    json_response(500, ['error' => 'register_failed', 'message' => 'Could not create your account. Please try again.']);
  }

  $token = issue_email_verification_token($userId, $email);
  $emailSent = false;
  if ($token !== '') {
    try {
      $emailSent = send_email_verification_email($pdo, $email, $token, $displayName);
    } catch (Throwable $e) {
      error_log('[turnout] send verify email: ' . $e->getMessage());
      $emailSent = false;
    }
  }

  return ['userId' => $userId, 'emailSent' => $emailSent];
}
