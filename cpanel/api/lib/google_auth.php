<?php

function google_oauth_client_id(): string {
  return trim((string)(getenv('GOOGLE_OAUTH_CLIENT_ID') ?: getenv('VITE_GOOGLE_OAUTH_CLIENT_ID') ?: ''));
}

function google_oauth_configured(): bool {
  return google_oauth_client_id() !== '';
}

function ensure_google_auth_columns(PDO $pdo): void {
  static $checked = false;
  if ($checked) return;
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  try {
    if ($driver === 'pgsql') {
      $pdo->exec('ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub VARCHAR(128) NULL');
      try {
        $pdo->exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users (google_sub)');
      } catch (Throwable $e) {}
    } elseif ($driver === 'sqlite') {
      try { $pdo->exec('ALTER TABLE users ADD COLUMN google_sub TEXT NULL'); } catch (Throwable $e) {}
      try { $pdo->exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users (google_sub)'); } catch (Throwable $e) {}
    } else {
      try { $pdo->exec('ALTER TABLE users ADD COLUMN google_sub VARCHAR(128) NULL'); } catch (Throwable $e) {}
      try { $pdo->exec('CREATE UNIQUE INDEX idx_users_google_sub ON users (google_sub)'); } catch (Throwable $e) {}
    }
  } catch (Throwable $e) {
    error_log(sprintf('[turnout] ensure_google_auth_columns: %s', $e->getMessage()));
  }
  $checked = true;
}

/**
 * Verify a Google ID token via Google's tokeninfo endpoint.
 *
 * @return array{sub:string,email:string,emailVerified:bool,name:string,picture:?string}|null
 */
function verify_google_id_token(string $idToken): ?array {
  $idToken = trim($idToken);
  $clientId = google_oauth_client_id();
  if ($idToken === '' || $clientId === '') return null;

  $url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . rawurlencode($idToken);
  $raw = null;
  $status = 0;

  if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_TIMEOUT => 8,
      CURLOPT_CONNECTTIMEOUT => 5,
      CURLOPT_HTTPGET => true,
    ]);
    $raw = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
  } else {
    $ctx = stream_context_create([
      'http' => [
        'method' => 'GET',
        'timeout' => 8,
        'ignore_errors' => true,
      ],
    ]);
    $raw = @file_get_contents($url, false, $ctx);
    if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) {
      $status = (int)$m[1];
    }
  }

  if (!is_string($raw) || $raw === '' || ($status !== 0 && $status !== 200)) {
    return null;
  }

  $payload = json_decode($raw, true);
  if (!is_array($payload)) return null;

  $aud = (string)($payload['aud'] ?? '');
  if ($aud === '' || !hash_equals($clientId, $aud)) {
    return null;
  }

  $iss = (string)($payload['iss'] ?? '');
  if ($iss !== 'accounts.google.com' && $iss !== 'https://accounts.google.com') {
    return null;
  }

  $sub = trim((string)($payload['sub'] ?? ''));
  $email = strtolower(trim((string)($payload['email'] ?? '')));
  if ($sub === '' || $email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    return null;
  }

  $emailVerifiedRaw = $payload['email_verified'] ?? false;
  $emailVerified = $emailVerifiedRaw === true
    || $emailVerifiedRaw === 1
    || $emailVerifiedRaw === '1'
    || $emailVerifiedRaw === 'true';
  if (!$emailVerified) {
    return null;
  }

  $exp = (int)($payload['exp'] ?? 0);
  if ($exp > 0 && $exp < time() - 30) {
    return null;
  }

  $name = trim((string)($payload['name'] ?? ''));
  if ($name === '') {
    $given = trim((string)($payload['given_name'] ?? ''));
    $family = trim((string)($payload['family_name'] ?? ''));
    $name = trim($given . ' ' . $family);
  }
  if ($name === '') {
    $name = explode('@', $email)[0] ?: 'User';
  }

  $picture = trim((string)($payload['picture'] ?? ''));

  return [
    'sub' => $sub,
    'email' => $email,
    'emailVerified' => true,
    'name' => $name,
    'picture' => $picture !== '' ? $picture : null,
  ];
}

function normalize_google_auth_role(string $role): string {
  $role = strtolower(trim($role));
  return $role === 'attendee' ? 'attendee' : 'organizer';
}

/**
 * Find or create a user from a verified Google profile, then return user id.
 * Links google_sub to an existing email account when roles match.
 */
function find_or_create_user_from_google(PDO $pdo, array $google, string $role): int {
  ensure_google_auth_columns($pdo);
  ensure_email_verification_support($pdo);

  $role = normalize_google_auth_role($role);
  $sub = (string)$google['sub'];
  $email = (string)$google['email'];
  $name = (string)$google['name'];

  $bySub = $pdo->prepare('SELECT * FROM users WHERE google_sub = ? LIMIT 1');
  $bySub->execute([$sub]);
  $row = $bySub->fetch();
  if (is_array($row)) {
    return complete_google_user_login_row($pdo, $row, $role, $sub, $name);
  }

  $byEmail = $pdo->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
  $byEmail->execute([$email]);
  $row = $byEmail->fetch();
  if (is_array($row)) {
    $existingRole = (string)($row['role'] ?? '');
    if ($existingRole === 'super_admin') {
      json_response(403, [
        'error' => 'google_auth_not_allowed',
        'message' => 'Super admin accounts must sign in with email and password.',
      ]);
    }
    if ($existingRole !== $role) {
      json_response(409, [
        'error' => 'role_mismatch',
        'message' => $existingRole === 'attendee'
          ? 'This Google account is already registered as an attendee. Switch to Attendee and try again.'
          : 'This Google account is already registered as an organizer. Switch to Organizer and try again.',
      ]);
    }

    $existingSub = trim((string)($row['google_sub'] ?? ''));
    if ($existingSub !== '' && $existingSub !== $sub) {
      json_response(409, [
        'error' => 'google_account_conflict',
        'message' => 'This email is already linked to a different Google account. Sign in with email and password instead.',
      ]);
    }

    $userId = (int)$row['id'];
    if ($existingSub === '') {
      $pdo->prepare('UPDATE users SET google_sub = ? WHERE id = ?')->execute([$sub, $userId]);
    }
    if (!user_email_is_verified($row)) {
      mark_user_email_verified($pdo, $userId);
    }
    if (trim((string)($row['display_name'] ?? '')) === '' && $name !== '') {
      $pdo->prepare('UPDATE users SET display_name = ? WHERE id = ?')->execute([$name, $userId]);
    }
    return $userId;
  }

  // New account — Google email is already verified.
  $unusableHash = password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT);
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  if ($driver === 'pgsql') {
    $ins = $pdo->prepare(
      'INSERT INTO users (email, password_hash, display_name, role, email_verified_at, google_sub)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
       RETURNING id'
    );
    $ins->execute([$email, $unusableHash, $name, $role, $sub]);
    $userId = (int)($ins->fetchColumn() ?: 0);
  } else {
    $ins = $pdo->prepare(
      'INSERT INTO users (email, password_hash, display_name, role, email_verified_at, google_sub)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)'
    );
    $ins->execute([$email, $unusableHash, $name, $role, $sub]);
    $userId = (int)$pdo->lastInsertId();
  }

  if ($userId <= 0) {
    json_response(500, ['error' => 'google_register_failed', 'message' => 'Could not create your account. Please try again.']);
  }

  return $userId;
}

/**
 * @param array<string,mixed> $row
 */
function complete_google_user_login_row(PDO $pdo, array $row, string $role, string $sub, string $name): int {
  $existingRole = (string)($row['role'] ?? '');
  if ($existingRole === 'super_admin') {
    json_response(403, [
      'error' => 'google_auth_not_allowed',
      'message' => 'Super admin accounts must sign in with email and password.',
    ]);
  }
  if ($existingRole !== $role) {
    json_response(409, [
      'error' => 'role_mismatch',
      'message' => $existingRole === 'attendee'
        ? 'This Google account is already registered as an attendee. Switch to Attendee and try again.'
        : 'This Google account is already registered as an organizer. Switch to Organizer and try again.',
    ]);
  }

  $userId = (int)$row['id'];
  if (trim((string)($row['google_sub'] ?? '')) === '') {
    $pdo->prepare('UPDATE users SET google_sub = ? WHERE id = ?')->execute([$sub, $userId]);
  }
  if (!user_email_is_verified($row)) {
    mark_user_email_verified($pdo, $userId);
  }
  if (trim((string)($row['display_name'] ?? '')) === '' && $name !== '') {
    $pdo->prepare('UPDATE users SET display_name = ? WHERE id = ?')->execute([$name, $userId]);
  }
  return $userId;
}
