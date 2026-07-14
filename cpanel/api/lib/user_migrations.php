<?php

function ensure_users_role_support(PDO $pdo): void {
  static $checked = false;
  if ($checked) return;
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  try {
    if ($driver === 'mysql') {
      $stmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'role'");
      $row = $stmt ? $stmt->fetch() : false;
      if (!$row) {
        try {
          $pdo->exec("ALTER TABLE users ADD COLUMN role VARCHAR(32) NOT NULL DEFAULT 'organizer'");
        } catch (Throwable $e) {
          // Column may already exist under a concurrent migrate.
        }
      } else {
        $type = strtolower((string)($row['Type'] ?? ''));
        if ($type !== '' && !str_contains($type, 'super_admin')) {
          try {
            $pdo->exec("ALTER TABLE users MODIFY COLUMN role ENUM('organizer','attendee','super_admin') NOT NULL DEFAULT 'organizer'");
          } catch (Throwable $e) {
            // Fall back to a free-form role column when ENUM widening fails
            // (common when unexpected legacy role values exist).
            try {
              $pdo->exec("ALTER TABLE users MODIFY COLUMN role VARCHAR(32) NOT NULL DEFAULT 'organizer'");
            } catch (Throwable $e2) {
              // Non-fatal: login must still work with the existing column.
            }
          }
        }
      }

      $stmt2 = $pdo->query("SHOW COLUMNS FROM users LIKE 'is_blocked'");
      if (!$stmt2 || !$stmt2->fetch()) {
        try {
          $pdo->exec("ALTER TABLE users ADD COLUMN is_blocked TINYINT(1) NOT NULL DEFAULT 0");
        } catch (Throwable $e) {}
      }
      $stmt3 = $pdo->query("SHOW COLUMNS FROM users LIKE 'status'");
      if (!$stmt3 || !$stmt3->fetch()) {
        try {
          $pdo->exec("ALTER TABLE users ADD COLUMN status ENUM('active','suspended','banned') NOT NULL DEFAULT 'active'");
        } catch (Throwable $e) {
          try {
            $pdo->exec("ALTER TABLE users ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'active'");
          } catch (Throwable $e2) {}
        }
      }
      $stmt4 = $pdo->query("SHOW COLUMNS FROM users LIKE 'force_password_reset'");
      if (!$stmt4 || !$stmt4->fetch()) {
        try {
          $pdo->exec("ALTER TABLE users ADD COLUMN force_password_reset TINYINT(1) NOT NULL DEFAULT 0");
        } catch (Throwable $e) {}
      }
      $stmt5 = $pdo->query("SHOW COLUMNS FROM events LIKE 'event_status'");
      if (!$stmt5 || !$stmt5->fetch()) {
        try {
          $pdo->exec("ALTER TABLE events ADD COLUMN event_status ENUM('pending','approved','rejected','suspended') NOT NULL DEFAULT 'approved'");
        } catch (Throwable $e) {
          try {
            $pdo->exec("ALTER TABLE events ADD COLUMN event_status VARCHAR(32) NOT NULL DEFAULT 'approved'");
          } catch (Throwable $e2) {}
        }
      }
      $stmt6 = $pdo->query("SHOW COLUMNS FROM events LIKE 'is_featured'");
      if (!$stmt6 || !$stmt6->fetch()) {
        try {
          $pdo->exec("ALTER TABLE events ADD COLUMN is_featured TINYINT(1) NOT NULL DEFAULT 0");
        } catch (Throwable $e) {}
      }
      $checked = true;
      return;
    }

    try { $pdo->exec("ALTER TABLE users ADD COLUMN is_blocked INTEGER NOT NULL DEFAULT 0"); } catch (Throwable $e) {}
    try { $pdo->exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'"); } catch (Throwable $e) {}
    try { $pdo->exec("ALTER TABLE users ADD COLUMN force_password_reset INTEGER NOT NULL DEFAULT 0"); } catch (Throwable $e) {}
    try { $pdo->exec("ALTER TABLE events ADD COLUMN event_status TEXT NOT NULL DEFAULT 'approved'"); } catch (Throwable $e) {}
    try { $pdo->exec("ALTER TABLE events ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0"); } catch (Throwable $e) {}
  } catch (Throwable $e) {
    // Non-fatal migration guard. Ignore and continue request flow.
    error_log(sprintf('[turnout] ensure_users_role_support: %s', $e->getMessage()));
  }
  $checked = true;
}
