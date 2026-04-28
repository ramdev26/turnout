<?php

$dbPath = __DIR__ . '/../cpanel/api/data/dev.sqlite';
$pdo = new PDO('sqlite:' . $dbPath);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$pdo->exec(
  "CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'organizer',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_blocked INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    force_password_reset INTEGER NOT NULL DEFAULT 0
  )"
);

$email = 'superadmin@turnout.local';
$passwordHash = password_hash('Password123!', PASSWORD_DEFAULT);

$stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
$stmt->execute([$email]);
$existing = $stmt->fetch(PDO::FETCH_ASSOC);

if ($existing) {
  $update = $pdo->prepare(
    "UPDATE users
     SET password_hash = ?, display_name = ?, role = ?, is_blocked = 0, status = 'active', force_password_reset = 0
     WHERE id = ?"
  );
  $update->execute([$passwordHash, 'Super Admin', 'super_admin', (int)$existing['id']]);
  echo "UPDATED\n";
} else {
  $insert = $pdo->prepare('INSERT INTO users (email, password_hash, display_name, role) VALUES (?, ?, ?, ?)');
  $insert->execute([$email, $passwordHash, 'Super Admin', 'super_admin']);
  echo "CREATED\n";
}
