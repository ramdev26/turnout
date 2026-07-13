<?php

function ensure_users_role_support(PDO $pdo): void {
  static $checked = false;
  if ($checked) return;
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  try {
    if ($driver === 'mysql') {
      $stmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'role'");
      $row = $stmt ? $stmt->fetch() : false;
      $type = is_array($row) ? strtolower((string)($row['Type'] ?? '')) : '';
      if ($type !== '' && !str_contains($type, 'super_admin')) {
        $pdo->exec("ALTER TABLE users MODIFY COLUMN role ENUM('organizer','attendee','super_admin') NOT NULL DEFAULT 'organizer'");
      }
      $stmt2 = $pdo->query("SHOW COLUMNS FROM users LIKE 'is_blocked'");
      if (!$stmt2 || !$stmt2->fetch()) {
        $pdo->exec("ALTER TABLE users ADD COLUMN is_blocked TINYINT(1) NOT NULL DEFAULT 0");
      }
      $stmt3 = $pdo->query("SHOW COLUMNS FROM users LIKE 'status'");
      if (!$stmt3 || !$stmt3->fetch()) {
        $pdo->exec("ALTER TABLE users ADD COLUMN status ENUM('active','suspended','banned') NOT NULL DEFAULT 'active'");
      }
      $stmt4 = $pdo->query("SHOW COLUMNS FROM users LIKE 'force_password_reset'");
      if (!$stmt4 || !$stmt4->fetch()) {
        $pdo->exec("ALTER TABLE users ADD COLUMN force_password_reset TINYINT(1) NOT NULL DEFAULT 0");
      }
      $stmt5 = $pdo->query("SHOW COLUMNS FROM events LIKE 'event_status'");
      if (!$stmt5 || !$stmt5->fetch()) {
        $pdo->exec("ALTER TABLE events ADD COLUMN event_status ENUM('pending','approved','rejected','suspended') NOT NULL DEFAULT 'approved'");
      }
      $stmt6 = $pdo->query("SHOW COLUMNS FROM events LIKE 'is_featured'");
      if (!$stmt6 || !$stmt6->fetch()) {
        $pdo->exec("ALTER TABLE events ADD COLUMN is_featured TINYINT(1) NOT NULL DEFAULT 0");
      }
      return;
    }
    $pdo->exec("ALTER TABLE users ADD COLUMN is_blocked INTEGER NOT NULL DEFAULT 0");
    $pdo->exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
    $pdo->exec("ALTER TABLE users ADD COLUMN force_password_reset INTEGER NOT NULL DEFAULT 0");
    $pdo->exec("ALTER TABLE events ADD COLUMN event_status TEXT NOT NULL DEFAULT 'approved'");
    $pdo->exec("ALTER TABLE events ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0");
  } catch (Throwable $e) {
    // Non-fatal migration guard. Ignore and continue request flow.
  }
  $checked = true;
}
