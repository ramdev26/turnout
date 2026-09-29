<?php

/**
 * Private event access codes — gate landing/checkout behind shared or single-use codes.
 */

function ensure_event_access_codes_table(PDO $pdo): void {
  static $checked = false;
  if ($checked) return;
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);

  if ($driver === 'sqlite') {
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS event_access_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        code TEXT NOT NULL,
        label TEXT NULL,
        max_uses INTEGER NULL,
        used_count INTEGER NOT NULL DEFAULT 0,
        expires_at TEXT NULL,
        revoked_at TEXT NULL,
        created_by_user_id INTEGER NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id, code)
      )'
    );
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_event_access_codes_event ON event_access_codes(event_id)');
  } elseif ($driver === 'pgsql') {
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS event_access_codes (
        id BIGSERIAL PRIMARY KEY,
        event_id BIGINT NOT NULL,
        code VARCHAR(64) NOT NULL,
        label VARCHAR(255) NULL,
        max_uses INT NULL,
        used_count INT NOT NULL DEFAULT 0,
        expires_at TIMESTAMP NULL,
        revoked_at TIMESTAMP NULL,
        created_by_user_id BIGINT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id, code)
      )'
    );
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_event_access_codes_event ON event_access_codes(event_id)');
  } else {
    $pdo->exec(
      "CREATE TABLE IF NOT EXISTS event_access_codes (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        event_id BIGINT UNSIGNED NOT NULL,
        code VARCHAR(64) NOT NULL,
        label VARCHAR(255) NULL,
        max_uses INT NULL,
        used_count INT NOT NULL DEFAULT 0,
        expires_at DATETIME NULL,
        revoked_at DATETIME NULL,
        created_by_user_id BIGINT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_event_access_code (event_id, code),
        KEY idx_event_access_codes_event (event_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
  }
  $checked = true;
}

function normalize_access_code(string $code): string {
  $code = strtoupper(trim($code));
  $code = preg_replace('/\s+/', '', $code) ?? $code;
  $code = preg_replace('/[^A-Z0-9\-]/', '', $code) ?? $code;
  return substr($code, 0, 64);
}

function generate_access_code(int $bytes = 4): string {
  $hex = strtoupper(bin2hex(random_bytes(max(3, $bytes))));
  // Readable XXXX-XXXX style
  if (strlen($hex) >= 8) {
    return substr($hex, 0, 4) . '-' . substr($hex, 4, 4);
  }
  return $hex;
}

function event_row_customization(array $row): array {
  $custom = json_decode((string)($row['customization_json'] ?? ''), true);
  return is_array($custom) ? $custom : [];
}

function event_private_access_enabled(array $row): bool {
  $custom = event_row_customization($row);
  return !empty($custom['privateAccess']);
}

function set_event_private_access(PDO $pdo, int $eventId, bool $enabled): array {
  $stmt = $pdo->prepare('SELECT customization_json FROM events WHERE id = ? LIMIT 1');
  $stmt->execute([$eventId]);
  $row = $stmt->fetch();
  if (!$row) json_response(404, ['error' => 'event_not_found']);
  $custom = json_decode((string)$row['customization_json'], true);
  if (!is_array($custom)) $custom = [];
  if ($enabled) $custom['privateAccess'] = true;
  else unset($custom['privateAccess']);
  $upd = $pdo->prepare('UPDATE events SET customization_json = ? WHERE id = ?');
  $upd->execute([json_encode($custom, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), $eventId]);
  return $custom;
}

function access_code_api_shape(array $r): array {
  return [
    'id' => (string)$r['id'],
    'eventId' => (string)$r['event_id'],
    'code' => (string)$r['code'],
    'label' => isset($r['label']) && $r['label'] !== null && $r['label'] !== '' ? (string)$r['label'] : null,
    'maxUses' => $r['max_uses'] !== null ? (int)$r['max_uses'] : null,
    'usedCount' => (int)($r['used_count'] ?? 0),
    'expiresAt' => !empty($r['expires_at']) ? gmdate('c', strtotime((string)$r['expires_at'])) : null,
    'revokedAt' => !empty($r['revoked_at']) ? gmdate('c', strtotime((string)$r['revoked_at'])) : null,
    'active' => empty($r['revoked_at']),
    'createdAt' => !empty($r['created_at']) ? gmdate('c', strtotime((string)$r['created_at'])) : null,
  ];
}

function list_event_access_codes(PDO $pdo, int $eventId): array {
  ensure_event_access_codes_table($pdo);
  $stmt = $pdo->prepare(
    'SELECT * FROM event_access_codes WHERE event_id = ? ORDER BY id DESC LIMIT 2000'
  );
  $stmt->execute([$eventId]);
  $out = [];
  while ($r = $stmt->fetch()) {
    $out[] = access_code_api_shape($r);
  }
  return $out;
}

function access_code_is_usable(array $r): bool {
  if (!empty($r['revoked_at'])) return false;
  if (!empty($r['expires_at'])) {
    $exp = strtotime((string)$r['expires_at']);
    if ($exp !== false && $exp < time()) return false;
  }
  // Access codes are always one-time use — once unlocked, further tries fail.
  if ((int)($r['used_count'] ?? 0) >= 1) return false;
  return true;
}

function find_access_code_row(PDO $pdo, int $eventId, string $code): ?array {
  ensure_event_access_codes_table($pdo);
  $normalized = normalize_access_code($code);
  if ($normalized === '') return null;
  $stmt = $pdo->prepare(
    'SELECT * FROM event_access_codes WHERE event_id = ? AND code = ? LIMIT 1'
  );
  $stmt->execute([$eventId, $normalized]);
  $row = $stmt->fetch();
  return $row ?: null;
}

function issue_event_access_token(int $eventId, ?int $codeId = null): string {
  $payload = [
    'eid' => $eventId,
    'exp' => time() + (60 * 60 * 24 * 30),
  ];
  if ($codeId !== null && $codeId > 0) $payload['cid'] = $codeId;
  $json = json_encode($payload, JSON_UNESCAPED_SLASHES);
  if (!is_string($json) || $json === '') return '';
  $encoded = b64url_encode($json);
  $sig = hash_hmac('sha256', $encoded, auth_signing_key());
  return $encoded . '.' . $sig;
}

function verify_event_access_token(string $token, int $eventId): bool {
  $token = trim($token);
  if ($token === '' || !str_contains($token, '.')) return false;
  [$encoded, $sig] = explode('.', $token, 2);
  if ($encoded === '' || $sig === '') return false;
  $expected = hash_hmac('sha256', $encoded, auth_signing_key());
  if (!hash_equals($expected, $sig)) return false;
  $json = b64url_decode($encoded);
  if ($json === null || $json === '') return false;
  $payload = json_decode($json, true);
  if (!is_array($payload)) return false;
  if ((int)($payload['eid'] ?? 0) !== $eventId) return false;
  $exp = (int)($payload['exp'] ?? 0);
  if ($exp > 0 && $exp < time()) return false;
  return true;
}

function read_event_access_token_from_request(int $eventId): string {
  $header = trim((string)($_SERVER['HTTP_X_EVENT_ACCESS_TOKEN'] ?? ''));
  if ($header !== '') return $header;

  $cookieName = 'turnout_event_access_' . $eventId;
  $cookie = trim((string)($_COOKIE[$cookieName] ?? ''));
  if ($cookie !== '') return $cookie;

  $q = trim((string)($_GET['accessToken'] ?? ''));
  if ($q !== '') return $q;

  return '';
}

function set_event_access_cookie(int $eventId, string $token): void {
  if ($token === '' || headers_sent()) return;
  $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
  setcookie('turnout_event_access_' . $eventId, $token, [
    'expires' => time() + (60 * 60 * 24 * 30),
    'path' => '/',
    'secure' => $secure,
    'httponly' => true,
    'samesite' => 'Lax',
  ]);
}

function viewer_has_event_access(PDO $pdo, array $row): bool {
  if (!event_private_access_enabled($row)) return true;

  $eventId = (int)$row['id'];
  $uid = current_user_id();
  if ($uid !== null) {
    if ((int)($row['organizer_user_id'] ?? 0) === $uid) return true;
    if (function_exists('user_can_access_event_row') && user_can_access_event_row($pdo, $row, $uid, 'viewer')) {
      return true;
    }
    if (function_exists('is_super_admin_user_id')) {
      // no-op fallback
    }
    try {
      $roleStmt = $pdo->prepare('SELECT role FROM users WHERE id = ? LIMIT 1');
      $roleStmt->execute([$uid]);
      $roleRow = $roleStmt->fetch();
      if (is_array($roleRow) && (string)($roleRow['role'] ?? '') === 'super_admin') return true;
    } catch (Throwable $e) {
      // ignore
    }
  }

  $token = read_event_access_token_from_request($eventId);
  if ($token !== '' && verify_event_access_token($token, $eventId)) return true;

  return false;
}

/**
 * @return array{ok:bool, token?:string, codeId?:int, error?:string, message?:string}
 */
function try_unlock_event_access(PDO $pdo, array $row, string $rawCode, bool $consume = true): array {
  if (!event_private_access_enabled($row)) {
    return ['ok' => true, 'token' => issue_event_access_token((int)$row['id'])];
  }

  $eventId = (int)$row['id'];
  $codeRow = find_access_code_row($pdo, $eventId, $rawCode);
  if (!$codeRow) {
    return ['ok' => false, 'error' => 'invalid_access_code', 'message' => 'That access code is not valid for this event.'];
  }
  if (!access_code_is_usable($codeRow)) {
    return ['ok' => false, 'error' => 'access_code_unavailable', 'message' => 'This access code has already been used, expired, or been revoked.'];
  }

  // Always consume on successful unlock so the code cannot be tried again.
  if ($consume) {
    $upd = $pdo->prepare(
      'UPDATE event_access_codes SET used_count = used_count + 1
       WHERE id = ? AND used_count = 0 AND revoked_at IS NULL'
    );
    $upd->execute([(int)$codeRow['id']]);
    if ($upd->rowCount() < 1) {
      return ['ok' => false, 'error' => 'access_code_unavailable', 'message' => 'This access code has already been used.'];
    }
  }

  $token = issue_event_access_token($eventId, (int)$codeRow['id']);
  set_event_access_cookie($eventId, $token);
  return ['ok' => true, 'token' => $token, 'codeId' => (int)$codeRow['id']];
}

function map_private_event_stub(array $row): array {
  $custom = event_row_customization($row);
  $primary = trim((string)($custom['primaryColor'] ?? ''));
  if ($primary === '' || !preg_match('/^#[0-9a-fA-F]{6}$/', $primary)) $primary = '#059669';
  return [
    'id' => (string)$row['id'],
    'slug' => (string)$row['slug'],
    'title' => (string)$row['title'],
    'status' => (string)$row['status'],
    'bannerUrl' => null,
    'description' => '',
    'date' => !empty($row['event_date']) ? gmdate('c', strtotime((string)$row['event_date'])) : null,
    'location' => '',
    'templateId' => (string)($row['template_id'] ?? 'template-2'),
    'privateAccess' => true,
    'accessRequired' => true,
    'customization' => [
      'privateAccess' => true,
      'primaryColor' => $primary,
      'secondaryColor' => (string)($custom['secondaryColor'] ?? '#10b981'),
      'fontFamily' => (string)($custom['fontFamily'] ?? 'fraunces'),
      'displayMode' => (string)($custom['displayMode'] ?? 'auto'),
      'landingStyle' => (string)($custom['landingStyle'] ?? 'minimal'),
      'heroText' => (string)$row['title'],
      'heroSubtext' => '',
      'layout' => 'standard',
    ],
  ];
}

function require_event_public_access(PDO $pdo, array $row): void {
  if (viewer_has_event_access($pdo, $row)) return;
  json_response(403, [
    'error' => 'access_required',
    'message' => 'This is a private event. Enter a valid access code to continue.',
    'event' => map_private_event_stub($row),
  ]);
}

function create_event_access_codes(
  PDO $pdo,
  int $eventId,
  int $count,
  ?int $maxUses,
  ?string $expiresAtSql,
  ?string $label,
  ?int $createdBy,
  ?string $customCode = null,
  bool $softFail = false
): array {
  ensure_event_access_codes_table($pdo);
  if ($count < 1) $count = 1;
  if ($count > 500) {
    json_response(400, ['error' => 'too_many_codes', 'message' => 'Generate at most 500 codes at a time.']);
  }
  // Access codes are always single-use, regardless of caller input.
  $maxUses = 1;

  $ins = $pdo->prepare(
    'INSERT INTO event_access_codes (event_id, code, label, max_uses, expires_at, created_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?)'
  );

  $created = [];
  $attempts = 0;
  $target = $customCode !== null && $customCode !== '' ? 1 : $count;

  while (count($created) < $target && $attempts < $target * 20) {
    $attempts++;
    $code = $customCode !== null && $customCode !== ''
      ? normalize_access_code($customCode)
      : generate_access_code();
    if ($code === '' || strlen($code) < 4) {
      if ($customCode !== null) {
        if ($softFail) return [];
        json_response(400, ['error' => 'invalid_access_code', 'message' => 'Access codes must be at least 4 characters (A–Z, 0–9, dash).']);
      }
      continue;
    }
    try {
      $ins->execute([
        $eventId,
        $code,
        $label !== null && trim($label) !== '' ? trim($label) : null,
        $maxUses,
        $expiresAtSql,
        $createdBy,
      ]);
      $id = (int)$pdo->lastInsertId();
      $created[] = [
        'id' => (string)$id,
        'eventId' => (string)$eventId,
        'code' => $code,
        'label' => $label !== null && trim($label) !== '' ? trim($label) : null,
        'maxUses' => $maxUses,
        'usedCount' => 0,
        'expiresAt' => $expiresAtSql ? gmdate('c', strtotime($expiresAtSql)) : null,
        'revokedAt' => null,
        'active' => true,
        'createdAt' => gmdate('c'),
      ];
      if ($customCode !== null) break;
    } catch (Throwable $e) {
      if ($customCode !== null) {
        if ($softFail) return [];
        json_response(409, ['error' => 'code_exists', 'message' => 'That access code already exists for this event.']);
      }
      // collision — retry
    }
  }

  if (count($created) < 1) {
    if ($softFail) return [];
    json_response(500, ['error' => 'code_generation_failed', 'message' => 'Could not generate access codes. Try again.']);
  }
  return $created;
}

function revoke_event_access_code(PDO $pdo, int $eventId, int $codeId): bool {
  ensure_event_access_codes_table($pdo);
  $upd = $pdo->prepare(
    'UPDATE event_access_codes SET revoked_at = ? WHERE id = ? AND event_id = ? AND revoked_at IS NULL'
  );
  $upd->execute([date('Y-m-d H:i:s'), $codeId, $eventId]);
  return $upd->rowCount() > 0;
}

function parse_access_expires_at(?string $raw): ?string {
  if ($raw === null) return null;
  $trimmed = trim($raw);
  if ($trimmed === '') return null;
  $ts = strtotime($trimmed);
  if ($ts === false) {
    json_response(400, ['error' => 'invalid_expires_at', 'message' => 'Enter a valid expiry date.']);
  }
  return date('Y-m-d H:i:s', $ts);
}
