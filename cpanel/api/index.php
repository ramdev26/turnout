<?php

require __DIR__ . '/lib/http.php';
require __DIR__ . '/lib/db.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/mail.php';
require __DIR__ . '/lib/banners.php';
require __DIR__ . '/lib/checkout.php';
require __DIR__ . '/lib/domains.php';
require __DIR__ . '/lib/checkin.php';
require __DIR__ . '/lib/checkout_fields.php';
require __DIR__ . '/lib/arena_gallery.php';
require __DIR__ . '/lib/organizer_team.php';
require __DIR__ . '/lib/organizer_payment.php';
require __DIR__ . '/lib/organizer_paid_event.php';
require __DIR__ . '/lib/user_migrations.php';
require __DIR__ . '/lib/super_admin.php';
require __DIR__ . '/lib/admin_analytics.php';
require __DIR__ . '/lib/core_schema.php';

set_cors_headers_for_same_domain();

// Basic preflight handling (safe even for same-domain; some setups might still send it).
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

start_app_session();

$path = get_path();
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

// Expect API to be mounted at /api. If deployed as /api/index.php, requests will be /api/...
// Normalize by stripping leading /api.
if (str_starts_with($path, '/api')) {
  $path = substr($path, 4);
  if ($path === false || $path === '') $path = '';
}

function is_same_origin_request(): bool {
  return is_trusted_origin_request();
}

function enforce_write_request_integrity(string $path, string $method): void {
  if ($method !== 'POST') return;
  // Webhooks are cross-origin by design.
  if ($path === '/payhere/notify') return;
  if ($path === '/organizer/billing/notify') return;
  // Public auth bootstrap endpoints are intentionally available pre-session.
  if ($path === '/auth/login' || $path === '/auth/register' || $path === '/auth/register-attendee' || $path === '/auth/forgot-password' || $path === '/auth/reset-password') return;
  // CSRF protection is required only for authenticated cookie sessions.
  if (current_user_id() === null) return;
  if (!is_same_origin_request()) {
    json_response(403, ['error' => 'csrf_origin_mismatch']);
  }
}

function require_organizer_user_id(): int {
  $uid = require_user_id();
  $user = load_user_profile($uid);
  if (($user['role'] ?? '') !== 'organizer') json_response(403, ['error' => 'forbidden']);
  return $uid;
}

function require_super_admin_user_id(): int {
  $uid = require_user_id();
  $user = load_user_profile($uid);
  if (($user['role'] ?? '') !== 'super_admin') json_response(403, ['error' => 'forbidden']);
  return $uid;
}

if (preg_match('#^/uploads/banners/([^/]+)$#', $path, $bannerMatch) && $method === 'GET') {
  serve_local_banner_file($bannerMatch[1]);
}

if (preg_match('#^/uploads/organizer-logos/([^/]+)$#', $path, $logoMatch) && $method === 'GET') {
  serve_local_organizer_logo_file($logoMatch[1]);
}
if (preg_match('#^/uploads/organizer-docs/([^/]+)$#', $path, $docMatch) && $method === 'GET') {
  serve_local_organizer_doc_file($docMatch[1]);
}

if ($path === '/uploads/banner' && $method === 'POST') {
  handle_banner_upload_post();
}

if ($path === '/uploads/organizer-logo' && $method === 'POST') {
  handle_organizer_logo_upload_post();
}
if ($path === '/uploads/organizer-document' && $method === 'POST') {
  $kind = trim((string)($_GET['kind'] ?? ''));
  handle_organizer_doc_upload_post($kind);
}

function slugify(string $s): string {
  $s = strtolower(trim($s));
  $s = preg_replace('/[^a-z0-9]+/', '-', $s);
  $s = preg_replace('/-+/', '-', $s);
  $s = trim($s, '-');
  if ($s === '') $s = 'event';
  return substr($s, 0, 160);
}

function unique_slug(PDO $pdo, string $base): string {
  $slug = $base;
  for ($i = 0; $i < 50; $i++) {
    $stmt = $pdo->prepare('SELECT id FROM events WHERE slug = ? LIMIT 1');
    $stmt->execute([$slug]);
    if (!$stmt->fetch()) return $slug;
    $slug = $base . '-' . substr(bin2hex(random_bytes(3)), 0, 6);
  }
  return $base . '-' . substr(bin2hex(random_bytes(5)), 0, 10);
}

function ensure_event_runbook_table(PDO $pdo): void {
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  if ($driver === 'sqlite') {
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS event_runbook_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT "medium",
        status TEXT NOT NULL DEFAULT "open",
        due_at TEXT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )'
    );
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_runbook_event_created ON event_runbook_items(event_id, created_at DESC)');
    return;
  }

  if ($driver === 'pgsql') {
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS event_runbook_items (
        id BIGSERIAL PRIMARY KEY,
        event_id BIGINT NOT NULL,
        title VARCHAR(255) NOT NULL,
        priority VARCHAR(16) NOT NULL DEFAULT \'medium\',
        status VARCHAR(16) NOT NULL DEFAULT \'open\',
        due_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )'
    );
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_runbook_event_created ON event_runbook_items(event_id, created_at DESC)');
    return;
  }

  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS event_runbook_items (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      event_id BIGINT UNSIGNED NOT NULL,
      title VARCHAR(255) NOT NULL,
      priority ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
      status ENUM('open','done') NOT NULL DEFAULT 'open',
      due_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_runbook_event_created (event_id, created_at),
      CONSTRAINT fk_runbook_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
}

function ensure_user_profiles_table(PDO $pdo): void {
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  if ($driver === 'sqlite') {
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS user_profiles (
        user_id INTEGER PRIMARY KEY,
        avatar_url TEXT NULL,
        phone TEXT NULL,
        bio TEXT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )'
    );
    return;
  }

  if ($driver === 'pgsql') {
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS user_profiles (
        user_id BIGINT PRIMARY KEY,
        avatar_url TEXT NULL,
        phone VARCHAR(60) NULL,
        bio TEXT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )'
    );
    return;
  }

  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS user_profiles (
      user_id BIGINT UNSIGNED NOT NULL,
      avatar_url TEXT NULL,
      phone VARCHAR(60) NULL,
      bio TEXT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id),
      CONSTRAINT fk_user_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
}

function ensure_payhere_tables(PDO $pdo): void {
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  if ($driver === 'sqlite') {
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS order_attendee_requests (
        order_id INTEGER PRIMARY KEY,
        attendees_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )'
    );
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS payhere_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        payment_id TEXT NULL,
        status_code TEXT NOT NULL,
        payhere_amount TEXT NULL,
        payhere_currency TEXT NULL,
        method TEXT NULL,
        status_message TEXT NULL,
        raw_post_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )'
    );
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_payhere_tx_order ON payhere_transactions(order_id, created_at DESC)');
    return;
  }

  if ($driver === 'pgsql') {
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS order_attendee_requests (
        order_id BIGINT PRIMARY KEY,
        attendees_json JSONB NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )'
    );
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS payhere_transactions (
        id BIGSERIAL PRIMARY KEY,
        order_id BIGINT NOT NULL,
        payment_id VARCHAR(64) NULL,
        status_code VARCHAR(16) NOT NULL,
        payhere_amount VARCHAR(32) NULL,
        payhere_currency VARCHAR(16) NULL,
        method VARCHAR(32) NULL,
        status_message TEXT NULL,
        raw_post_json JSONB NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )'
    );
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_payhere_tx_order ON payhere_transactions(order_id, created_at DESC)');
    return;
  }

  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS order_attendee_requests (
      order_id BIGINT UNSIGNED NOT NULL,
      attendees_json JSON NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (order_id),
      CONSTRAINT fk_oar_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS payhere_transactions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      order_id BIGINT UNSIGNED NOT NULL,
      payment_id VARCHAR(64) NULL,
      status_code VARCHAR(16) NOT NULL,
      payhere_amount VARCHAR(32) NULL,
      payhere_currency VARCHAR(16) NULL,
      method VARCHAR(32) NULL,
      status_message TEXT NULL,
      raw_post_json JSON NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_payhere_tx_order (order_id, created_at),
      CONSTRAINT fk_payhere_tx_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
}

function ensure_finance_tables(PDO $pdo): void {
  static $checked = false;
  if ($checked) return;
  try {
    ensure_finance_tables_inner($pdo);
  } catch (Throwable $e) {
    error_log(sprintf('[turnout] ensure_finance_tables: %s', $e->getMessage()));
  }
  $checked = true;
}

function ensure_finance_tables_inner(PDO $pdo): void {
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  if ($driver === 'sqlite') {
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS admin_settings (
        setting_key TEXT PRIMARY KEY,
        setting_value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )'
    );
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        user_id INTEGER NULL,
        order_id INTEGER NULL,
        amount_cents INTEGER NOT NULL,
        platform_fee_cents INTEGER NOT NULL,
        organizer_amount_cents INTEGER NOT NULL,
        payment_status TEXT NOT NULL DEFAULT "pending",
        payhere_reference TEXT NULL,
        is_flagged INTEGER NOT NULL DEFAULT 0,
        admin_note TEXT NULL,
        refund_requested INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )'
    );
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS payouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organizer_id INTEGER NOT NULL,
        total_amount_cents INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT "pending",
        method TEXT NOT NULL DEFAULT "bank_transfer",
        reference TEXT NULL,
        notes TEXT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT NULL
      )'
    );
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS global_settings (
        setting_key TEXT PRIMARY KEY,
        setting_value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )'
    );
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS payout_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payout_id INTEGER NOT NULL,
        admin_user_id INTEGER NULL,
        action TEXT NOT NULL,
        note TEXT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )'
    );
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_user_id INTEGER NULL,
        actor_role TEXT NULL,
        action TEXT NOT NULL,
        target_type TEXT NULL,
        target_id TEXT NULL,
        details_json TEXT NULL,
        ip_address TEXT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )'
    );
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_tx_status_created ON transactions(payment_status, created_at DESC)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_payout_org ON payouts(organizer_id, created_at DESC)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_payout_logs_payout ON payout_logs(payout_id, created_at DESC)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_logs_action_created ON logs(action, created_at DESC)");
    try { $pdo->exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'"); } catch (Throwable $e) {}
    try { $pdo->exec("ALTER TABLE users ADD COLUMN force_password_reset INTEGER NOT NULL DEFAULT 0"); } catch (Throwable $e) {}
    try { $pdo->exec("ALTER TABLE events ADD COLUMN event_status TEXT NOT NULL DEFAULT 'approved'"); } catch (Throwable $e) {}
    try { $pdo->exec("ALTER TABLE events ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0"); } catch (Throwable $e) {}
    try { $pdo->exec("ALTER TABLE transactions ADD COLUMN is_flagged INTEGER NOT NULL DEFAULT 0"); } catch (Throwable $e) {}
    try { $pdo->exec("ALTER TABLE transactions ADD COLUMN admin_note TEXT NULL"); } catch (Throwable $e) {}
    try { $pdo->exec("ALTER TABLE transactions ADD COLUMN refund_requested INTEGER NOT NULL DEFAULT 0"); } catch (Throwable $e) {}
    return;
  }
  if ($driver === 'pgsql') {
    $pdo->exec(
      "CREATE TABLE IF NOT EXISTS admin_settings (
        setting_key VARCHAR(120) PRIMARY KEY,
        setting_value TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )"
    );
    $pdo->exec(
      "CREATE TABLE IF NOT EXISTS transactions (
        id BIGSERIAL PRIMARY KEY,
        event_id BIGINT NOT NULL,
        user_id BIGINT NULL,
        order_id BIGINT NULL,
        amount_cents INTEGER NOT NULL,
        platform_fee_cents INTEGER NOT NULL,
        organizer_amount_cents INTEGER NOT NULL,
        payment_status VARCHAR(16) NOT NULL DEFAULT 'pending',
        payhere_reference VARCHAR(128) NULL,
        is_flagged SMALLINT NOT NULL DEFAULT 0,
        admin_note TEXT NULL,
        refund_requested SMALLINT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )"
    );
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_tx_status_created ON transactions(payment_status, created_at DESC)");
    $pdo->exec(
      "CREATE TABLE IF NOT EXISTS payouts (
        id BIGSERIAL PRIMARY KEY,
        organizer_id BIGINT NOT NULL,
        total_amount_cents INTEGER NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'pending',
        method VARCHAR(32) NOT NULL DEFAULT 'bank_transfer',
        reference VARCHAR(128) NULL,
        notes TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP NULL
      )"
    );
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_payout_org ON payouts(organizer_id, created_at DESC)");
    $pdo->exec(
      "CREATE TABLE IF NOT EXISTS global_settings (
        setting_key VARCHAR(120) PRIMARY KEY,
        setting_value TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )"
    );
    $pdo->exec(
      "CREATE TABLE IF NOT EXISTS payout_logs (
        id BIGSERIAL PRIMARY KEY,
        payout_id BIGINT NOT NULL,
        admin_user_id BIGINT NULL,
        action VARCHAR(64) NOT NULL,
        note TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )"
    );
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_payout_logs_payout ON payout_logs(payout_id, created_at DESC)");
    $pdo->exec(
      "CREATE TABLE IF NOT EXISTS logs (
        id BIGSERIAL PRIMARY KEY,
        actor_user_id BIGINT NULL,
        actor_role VARCHAR(40) NULL,
        action VARCHAR(120) NOT NULL,
        target_type VARCHAR(80) NULL,
        target_id VARCHAR(80) NULL,
        details_json JSONB NULL,
        ip_address VARCHAR(64) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )"
    );
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_logs_action_created ON logs(action, created_at DESC)");
    try { $pdo->exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'"); } catch (Throwable $e) {}
    try { $pdo->exec("ALTER TABLE users ADD COLUMN force_password_reset SMALLINT NOT NULL DEFAULT 0"); } catch (Throwable $e) {}
    try { $pdo->exec("ALTER TABLE events ADD COLUMN event_status TEXT NOT NULL DEFAULT 'approved'"); } catch (Throwable $e) {}
    try { $pdo->exec("ALTER TABLE events ADD COLUMN is_featured SMALLINT NOT NULL DEFAULT 0"); } catch (Throwable $e) {}
    try { $pdo->exec("ALTER TABLE transactions ADD COLUMN is_flagged SMALLINT NOT NULL DEFAULT 0"); } catch (Throwable $e) {}
    try { $pdo->exec("ALTER TABLE transactions ADD COLUMN admin_note TEXT NULL"); } catch (Throwable $e) {}
    try { $pdo->exec("ALTER TABLE transactions ADD COLUMN refund_requested SMALLINT NOT NULL DEFAULT 0"); } catch (Throwable $e) {}
    return;
  }

  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS admin_settings (
      setting_key VARCHAR(120) NOT NULL,
      setting_value VARCHAR(255) NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (setting_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS transactions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      event_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NULL,
      order_id BIGINT UNSIGNED NULL,
      amount_cents INT UNSIGNED NOT NULL,
      platform_fee_cents INT UNSIGNED NOT NULL,
      organizer_amount_cents INT UNSIGNED NOT NULL,
      payment_status ENUM('pending','paid','failed') NOT NULL DEFAULT 'pending',
      payhere_reference VARCHAR(128) NULL,
      is_flagged TINYINT(1) NOT NULL DEFAULT 0,
      admin_note TEXT NULL,
      refund_requested TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_tx_event (event_id),
      KEY idx_tx_user (user_id),
      KEY idx_tx_status_created (payment_status, created_at),
      KEY idx_tx_order (order_id),
      CONSTRAINT fk_tx_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      CONSTRAINT fk_tx_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT fk_tx_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS payouts (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      organizer_id BIGINT UNSIGNED NOT NULL,
      total_amount_cents INT UNSIGNED NOT NULL,
      status ENUM('pending','processing','completed') NOT NULL DEFAULT 'pending',
      method ENUM('bank_transfer') NOT NULL DEFAULT 'bank_transfer',
      reference VARCHAR(128) NULL,
      notes TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME NULL,
      PRIMARY KEY (id),
      KEY idx_payout_org (organizer_id, created_at),
      KEY idx_payout_status (status, created_at),
      CONSTRAINT fk_payout_org FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS global_settings (
      setting_key VARCHAR(120) NOT NULL,
      setting_value TEXT NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (setting_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS payout_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      payout_id BIGINT UNSIGNED NOT NULL,
      admin_user_id BIGINT UNSIGNED NULL,
      action VARCHAR(64) NOT NULL,
      note TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_payout_logs_payout (payout_id, created_at),
      CONSTRAINT fk_payout_logs_payout FOREIGN KEY (payout_id) REFERENCES payouts(id) ON DELETE CASCADE,
      CONSTRAINT fk_payout_logs_admin FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      actor_user_id BIGINT UNSIGNED NULL,
      actor_role VARCHAR(40) NULL,
      action VARCHAR(120) NOT NULL,
      target_type VARCHAR(80) NULL,
      target_id VARCHAR(80) NULL,
      details_json JSON NULL,
      ip_address VARCHAR(64) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_logs_action_created (action, created_at),
      KEY idx_logs_actor_created (actor_user_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
  try { $pdo->exec("ALTER TABLE users ADD COLUMN status ENUM('active','suspended','banned') NOT NULL DEFAULT 'active'"); } catch (Throwable $e) {}
  try { $pdo->exec("ALTER TABLE users ADD COLUMN force_password_reset TINYINT(1) NOT NULL DEFAULT 0"); } catch (Throwable $e) {}
  try { $pdo->exec("ALTER TABLE events ADD COLUMN event_status ENUM('pending','approved','rejected','suspended') NOT NULL DEFAULT 'approved'"); } catch (Throwable $e) {}
  try { $pdo->exec("ALTER TABLE events ADD COLUMN is_featured TINYINT(1) NOT NULL DEFAULT 0"); } catch (Throwable $e) {}
  try { $pdo->exec("ALTER TABLE transactions ADD COLUMN is_flagged TINYINT(1) NOT NULL DEFAULT 0"); } catch (Throwable $e) {}
  try { $pdo->exec("ALTER TABLE transactions ADD COLUMN admin_note TEXT NULL"); } catch (Throwable $e) {}
  try { $pdo->exec("ALTER TABLE transactions ADD COLUMN refund_requested TINYINT(1) NOT NULL DEFAULT 0"); } catch (Throwable $e) {}
}

function boolish(mixed $value): bool {
  if (is_bool($value)) return $value;
  if (is_numeric($value)) return ((int)$value) === 1;
  if (is_string($value)) return in_array(strtolower(trim($value)), ['1', 'true', 'yes', 'on'], true);
  return false;
}

function write_log(PDO $pdo, ?int $actorUserId, ?string $actorRole, string $action, ?string $targetType = null, ?string $targetId = null, ?array $details = null): void {
  ensure_finance_tables($pdo);
  $ip = (string)($_SERVER['REMOTE_ADDR'] ?? '');
  $stmt = $pdo->prepare('INSERT INTO logs (actor_user_id, actor_role, action, target_type, target_id, details_json, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)');
  $stmt->execute([
    $actorUserId,
    $actorRole,
    $action,
    $targetType,
    $targetId,
    $details ? json_encode($details, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : null,
    $ip !== '' ? $ip : null,
  ]);
}

function get_platform_commission_pct(PDO $pdo): float {
  ensure_finance_tables($pdo);
  $stmt = $pdo->prepare('SELECT setting_value FROM admin_settings WHERE setting_key = ? LIMIT 1');
  $stmt->execute(['commission_pct']);
  $row = $stmt->fetch();
  $value = $row ? (float)$row['setting_value'] : 10.0;
  if ($value < 0) $value = 0;
  if ($value > 100) $value = 100;
  return $value;
}

/** Read a value from the global_settings table (empty/missing -> default). */
function get_global_setting(PDO $pdo, string $key, ?string $default = null): ?string {
  try {
    $stmt = $pdo->prepare('SELECT setting_value FROM global_settings WHERE setting_key = ? LIMIT 1');
    $stmt->execute([$key]);
    $row = $stmt->fetch();
    if ($row && $row['setting_value'] !== null && trim((string)$row['setting_value']) !== '') {
      return (string)$row['setting_value'];
    }
  } catch (Throwable $e) {
    // table may not exist yet — fall through to default
  }
  return $default;
}

/** Build the public base URL (scheme + host) of the current request. */
function payhere_request_base_url(): string {
  $host = trim((string)($_SERVER['HTTP_HOST'] ?? ''));
  if ($host === '') return '';
  $https = (!empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off')
    || strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
  return ($https ? 'https' : 'http') . '://' . $host;
}

function upsert_transaction(PDO $pdo, int $eventId, ?int $userId, int $orderId, int $amountCents, string $status, ?string $reference): array {
  $commissionPct = get_platform_commission_pct($pdo);

  $orgStmt = $pdo->prepare('SELECT organizer_user_id FROM events WHERE id = ? LIMIT 1');
  $orgStmt->execute([$eventId]);
  $orgRow = $orgStmt->fetch();
  $organizerUserId = (int)($orgRow['organizer_user_id'] ?? 0);
  if ($organizerUserId <= 0) {
    json_response(400, ['error' => 'organizer_not_found']);
  }

  $ticketCount = 1;
  $orderStmt = $pdo->prepare('SELECT tickets_json FROM orders WHERE id = ? LIMIT 1');
  $orderStmt->execute([$orderId]);
  $orderRow = $orderStmt->fetch();
  if (is_array($orderRow)) {
    $items = json_decode((string)($orderRow['tickets_json'] ?? '[]'), true);
    if (is_array($items)) {
      $count = 0;
      foreach ($items as $it) {
        if (!is_array($it)) continue;
        $count += max(0, (int)($it['quantity'] ?? 0));
      }
      $ticketCount = max(1, $count);
    }
  }

  $commission = organizer_platform_fee_breakdown($pdo, $organizerUserId, $amountCents, $ticketCount, $commissionPct);
  $platformFeeCents = (int)$commission['platformFeeCents'];
  $organizerAmountCents = (int)$commission['organizerAmountCents'];

  $existingStmt = $pdo->prepare('SELECT id FROM transactions WHERE order_id = ? LIMIT 1');
  $existingStmt->execute([$orderId]);
  $existing = $existingStmt->fetch();
  if ($existing) {
    $upd = $pdo->prepare('UPDATE transactions SET amount_cents = ?, platform_fee_cents = ?, organizer_amount_cents = ?, payment_status = ?, payhere_reference = ? WHERE id = ?');
    $upd->execute([$amountCents, $platformFeeCents, $organizerAmountCents, $status, $reference, (int)$existing['id']]);
  } else {
    $ins = $pdo->prepare('INSERT INTO transactions (event_id, user_id, order_id, amount_cents, platform_fee_cents, organizer_amount_cents, payment_status, payhere_reference) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $ins->execute([$eventId, $userId, $orderId, $amountCents, $platformFeeCents, $organizerAmountCents, $status, $reference]);
  }

  return [
    'commissionPct' => $commissionPct,
    'commissionMode' => (string)($commission['commissionMode'] ?? 'percentage'),
    'commissionValue' => (float)($commission['commissionValue'] ?? $commissionPct),
    'platformFeeCents' => $platformFeeCents,
    'organizerAmountCents' => $organizerAmountCents,
  ];
}

/**
 * Mark order paid, create attendees, update inventory, and send confirmation email.
 * Safe to call more than once (skips when attendees already exist).
 */
function payhere_fulfill_paid_order(PDO $pdo, int $orderId, ?string $paymentId = null, ?string $payhereAmount = null): void {
  $check = $pdo->prepare('SELECT id FROM attendees WHERE order_id = ? LIMIT 1');
  $check->execute([$orderId]);
  if ($check->fetch()) {
    return;
  }

  $o = $pdo->prepare(
    'SELECT event_id, buyer_user_id, buyer_name, buyer_email, buyer_phone, tickets_json, total_amount_cents, status
     FROM orders WHERE id = ? LIMIT 1'
  );
  $o->execute([$orderId]);
  $orderRow = $o->fetch();
  if (!$orderRow) {
    throw new Exception('order_not_found');
  }

  if (
    $payhereAmount !== null &&
    $payhereAmount !== '' &&
    !payhere_amount_matches_order_cents((int)$orderRow['total_amount_cents'], $payhereAmount)
  ) {
    throw new Exception('amount_mismatch');
  }

  if ((string)$orderRow['status'] !== 'paid') {
    $upd = $pdo->prepare("UPDATE orders SET status = 'paid' WHERE id = ?");
    $upd->execute([$orderId]);
  }

  $eventId = (int)$orderRow['event_id'];
  $buyerUserId = $orderRow['buyer_user_id'] !== null ? (int)$orderRow['buyer_user_id'] : null;
  $orderTotalCents = (int)$orderRow['total_amount_cents'];
  $buyerEmail = (string)$orderRow['buyer_email'];
  $buyerPhone = (string)($orderRow['buyer_phone'] ?? '');

  $req = $pdo->prepare('SELECT attendees_json FROM order_attendee_requests WHERE order_id = ? LIMIT 1');
  $req->execute([$orderId]);
  $reqRow = $req->fetch();
  $attendeesReq = $reqRow ? json_decode($reqRow['attendees_json'], true) : [];
  if (!is_array($attendeesReq)) {
    $attendeesReq = [];
  }

  $items = json_decode($orderRow['tickets_json'], true);
  if (!is_array($items)) {
    $items = [];
  }
  $expected = expected_attendee_count_from_items($items);
  $evRow = load_event_row_or_404($pdo, $eventId);
  $checkoutFields = checkout_fields_from_event_row($evRow);
  $created = insert_attendees_for_order(
    $pdo,
    $orderId,
    $eventId,
    $attendeesReq,
    $buyerEmail,
    $buyerPhone,
    (string)($orderRow['buyer_name'] ?? 'Attendee'),
    $checkoutFields
  );
  if ($created !== $expected) {
    throw new Exception('attendee_create_failed');
  }

  increment_ticket_sold_counts($pdo, $items);

  upsert_transaction(
    $pdo,
    $eventId,
    $buyerUserId,
    $orderId,
    $orderTotalCents,
    'paid',
    $paymentId !== null && $paymentId !== '' ? $paymentId : null
  );
  send_order_confirmation_email($pdo, $orderId);
}

/** Complete a pending order when PayHere logged a successful charge but notify fulfillment failed. */
function payhere_sync_order_from_transactions(PDO $pdo, int $orderId): void {
  ensure_payhere_tables($pdo);
  $txStmt = $pdo->prepare(
    "SELECT payment_id, payhere_amount FROM payhere_transactions WHERE order_id = ? AND status_code = '2' ORDER BY id DESC LIMIT 1"
  );
  $txStmt->execute([$orderId]);
  $tx = $txStmt->fetch();
  if (!$tx) {
    return;
  }

  $curStmt = $pdo->prepare('SELECT status FROM orders WHERE id = ? LIMIT 1');
  $curStmt->execute([$orderId]);
  $cur = $curStmt->fetch();
  if (!$cur) {
    return;
  }
  $status = (string)$cur['status'];
  if ($status === 'failed') {
    return;
  }

  try {
    if ($status === 'pending') {
      $pdo->beginTransaction();
      try {
        payhere_fulfill_paid_order(
          $pdo,
          $orderId,
          isset($tx['payment_id']) ? (string)$tx['payment_id'] : null,
          isset($tx['payhere_amount']) ? (string)$tx['payhere_amount'] : null
        );
        $pdo->commit();
      } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
      }
    } elseif ($status === 'paid') {
      payhere_fulfill_paid_order(
        $pdo,
        $orderId,
        isset($tx['payment_id']) ? (string)$tx['payment_id'] : null,
        isset($tx['payhere_amount']) ? (string)$tx['payhere_amount'] : null
      );
    }
  } catch (Throwable $e) {
    error_log('Turnout payhere_sync order ' . $orderId . ': ' . $e->getMessage());
  }
}

function payhere_cfg(): array {
  $cfg = get_config();
  $p = is_array($cfg['payhere'] ?? null) ? $cfg['payhere'] : [];

  $merchantId = trim((string)($p['merchant_id'] ?? ''));
  $merchantSecret = trim((string)($p['merchant_secret'] ?? ''));
  $sandbox = (bool)($p['sandbox'] ?? true);

  if ($merchantId === '' || $merchantId === 'CHANGE_ME' || $merchantSecret === '' || $merchantSecret === 'CHANGE_ME') {
    json_response(500, [
      'error' => 'payhere_missing_credentials',
      'message' => 'Set PAYHERE_MERCHANT_ID and PAYHERE_MERCHANT_SECRET (or payhere.merchant_id / merchant_secret in config).',
    ]);
  }

  // Merchant secrets are domain-specific in PayHere. Prefer configured APP_BASE_URL
  // (must match an approved domain in PayHere Integrations) over preview hostnames.
  $configuredBase = rtrim((string)($p['app_base_url'] ?? ''), '/');
  $requestBase = rtrim(payhere_request_base_url(), '/');
  $appBase = $configuredBase !== '' ? $configuredBase : $requestBase;
  if ($appBase === '') {
    json_response(500, ['error' => 'payhere_missing_app_base_url']);
  }
  $notifyUrl = $appBase . '/api/payhere/notify';

  return [
    'sandbox' => $sandbox,
    'merchant_id' => $merchantId,
    'merchant_secret' => $merchantSecret,
    'notify_url' => $notifyUrl,
    'app_base_url' => $appBase,
  ];
}

/**
 * Bootstrapping migrations must never take down the API (login, health, etc.).
 * Log and continue so optional schema work cannot cause site-wide 500s.
 */
function run_boot_schema_guard(string $label, callable $fn): void {
  try {
    $fn();
  } catch (Throwable $e) {
    error_log(sprintf('[turnout][%s] boot schema %s failed: %s in %s:%d', request_id(), $label, $e->getMessage(), $e->getFile(), $e->getLine()));
  }
}

run_boot_schema_guard('ensure_core_schema', static fn () => ensure_core_schema(db()));
run_boot_schema_guard('ensure_users_role_support', static fn () => ensure_users_role_support(db()));
run_boot_schema_guard('ensure_default_super_admin', static fn () => ensure_default_super_admin(db()));
run_boot_schema_guard('ensure_finance_tables', static fn () => ensure_finance_tables(db()));
run_boot_schema_guard('ensure_events_custom_domain_column', static fn () => ensure_events_custom_domain_column(db()));
run_boot_schema_guard('ensure_attendees_custom_fields_column', static fn () => ensure_attendees_custom_fields_column(db()));
run_boot_schema_guard('ensure_organizer_workspace_tables', static fn () => ensure_organizer_workspace_tables(db()));
run_boot_schema_guard('ensure_organizer_payment_tables', static fn () => ensure_organizer_payment_tables(db()));
enforce_write_request_integrity($path, $method);

if ($path === '/health' && $method === 'GET') {
  $payload = [
    'ok' => true,
    'service' => 'turnout-api',
    'db' => false,
  ];
  try {
    $pdo = db();
    $pdo->query('SELECT 1');
    $payload['db'] = true;
    $payload['driver'] = (string)$pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    json_response(200, $payload);
  } catch (Throwable $e) {
    $payload['ok'] = false;
    $payload['error'] = 'db_unavailable';
    $payload['message'] = $e->getMessage();
    json_response(503, $payload);
  }
}


function load_event_row_or_404(PDO $pdo, int $eventId): array {
  $stmt = $pdo->prepare('SELECT * FROM events WHERE id = ? LIMIT 1');
  $stmt->execute([$eventId]);
  $row = $stmt->fetch();
  if (!$row) json_response(404, ['error' => 'event_not_found']);
  return $row;
}

function can_view_event_row(array $row, ?int $uid): bool {
  if (is_event_publicly_visible($row)) return true;
  if ($uid === null) return false;
  $pdo = db();
  if (user_can_access_event_row($pdo, $row, $uid, 'viewer')) return true;
  $roleStmt = $pdo->prepare('SELECT role FROM users WHERE id = ? LIMIT 1');
  $roleStmt->execute([$uid]);
  $roleRow = $roleStmt->fetch();
  return is_array($roleRow) && (string)($roleRow['role'] ?? '') === 'super_admin';
}

function payhere_amount_format(float $amount): string {
  return number_format($amount, 2, '.', '');
}

/**
 * PayHere checkout hash (mandatory on Checkout API).
 *
 * Same as PayHere Node sample:
 *   MD5(merchantId + orderId + amount + currency + MD5(merchantSecret).toUpperCase()).toUpperCase()
 *
 * `amount` must already be formatted to 2 decimals (e.g. "1500.00") and must match the
 * `amount` field posted to checkout.
 */
function payhere_hash(string $merchantId, string $orderId, string $amountFormatted, string $currency, string $merchantSecret): string {
  $merchantSecret = trim($merchantSecret);
  $secretDigest = strtoupper(md5($merchantSecret));
  return strtoupper(md5($merchantId . $orderId . $amountFormatted . $currency . $secretDigest));
}

/** Checkout fields for PayHere JS SDK / Checkout API (hash is mandatory). */
function payhere_checkout_payment(
  array $cfg,
  string $merchantId,
  string $merchantSecret,
  string $orderIdStr,
  int $totalCents,
  string $currency,
  string $itemsTitle,
  string $firstName,
  string $lastName,
  string $buyerEmail,
  string $buyerPhone,
  string $returnUrl,
  string $cancelUrl
): array {
  $amountFormatted = payhere_amount_format_cents($totalCents);
  $hash = payhere_hash($merchantId, $orderIdStr, $amountFormatted, $currency, $merchantSecret);
  if ($hash === '') {
    json_response(500, [
      'error' => 'payhere_hash_failed',
      'message' => 'Could not generate PayHere checkout hash.',
    ]);
  }

  return [
    'sandbox' => (bool)$cfg['sandbox'],
    'merchant_id' => (string)$merchantId,
    'return_url' => $returnUrl,
    'cancel_url' => $cancelUrl,
    'notify_url' => (string)$cfg['notify_url'],
    'order_id' => $orderIdStr,
    'items' => $itemsTitle,
    'currency' => $currency,
    'amount' => $amountFormatted,
    'first_name' => $firstName,
    'last_name' => $lastName,
    'email' => $buyerEmail,
    'phone' => $buyerPhone,
    'address' => 'N/A',
    'city' => 'N/A',
    'country' => 'Sri Lanka',
    'hash' => $hash,
    'custom_1' => 'turnout',
    'custom_2' => '',
  ];
}

/**
 * PayHere notify_url signature (md5sig) per official docs:
 * UPPER(MD5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + UPPER(MD5(merchant_secret))))
 */
function payhere_local_md5sig(string $merchantId, string $orderId, string $payhereAmount, string $payhereCurrency, string $statusCode, string $merchantSecret): string {
  $secretDigest = strtoupper(md5(trim($merchantSecret)));
  return strtoupper(
    md5(
      $merchantId .
        $orderId .
        $payhereAmount .
        $payhereCurrency .
        $statusCode .
        $secretDigest
    )
  );
}

function payhere_notify_signature_valid(string $localMd5sig, string $receivedMd5sig): bool {
  return hash_equals(strtoupper($localMd5sig), strtoupper(trim($receivedMd5sig)));
}

/** Server-side probe: POST a test checkout to PayHere with current credentials. */
function payhere_sandbox_probe(array $cfg): array {
  $merchantId = $cfg['merchant_id'];
  $orderId = 'probe' . (string)time();
  $amount = '10.00';
  $currency = 'LKR';
  $hash = payhere_hash($merchantId, $orderId, $amount, $currency, $cfg['merchant_secret']);
  $base = $cfg['app_base_url'];
  $postFields = [
    'merchant_id' => $merchantId,
    'return_url' => $base . '/payhere/return',
    'cancel_url' => $base . '/payhere/cancel',
    'notify_url' => $cfg['notify_url'],
    'order_id' => $orderId,
    'items' => 'Turnout probe',
    'amount' => $amount,
    'currency' => $currency,
    'hash' => $hash,
    'first_name' => 'Test',
    'last_name' => 'User',
    'email' => 'test@example.com',
    'phone' => '0771234567',
    'address' => 'N/A',
    'city' => 'Colombo',
    'country' => 'Sri Lanka',
  ];
  $url = $cfg['sandbox'] ? 'https://sandbox.payhere.lk/pay/checkout' : 'https://www.payhere.lk/pay/checkout';
  $ctx = stream_context_create([
    'http' => [
      'method' => 'POST',
      'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
      'content' => http_build_query($postFields),
      'timeout' => 15,
      'ignore_errors' => true,
    ],
  ]);
  $resp = @file_get_contents($url, false, $ctx);
  $accepted = is_string($resp) && str_contains($resp, '"status":1');
  $unauthorized = is_string($resp) && str_contains($resp, 'Unauthorized');
  $host = parse_url($base, PHP_URL_HOST) ?: $base;

  return [
    'accepted' => $accepted,
    'unauthorized' => $unauthorized,
    'sandbox' => (bool)$cfg['sandbox'],
    'merchantId' => $merchantId,
    'appBaseUrl' => $base,
    'notifyUrl' => $cfg['notify_url'],
    'message' => $accepted
      ? 'PayHere accepted a probe checkout with the configured credentials.'
      : ($unauthorized
        ? "PayHere returned Unauthorized. In sandbox PayHere → Integrations, approve domain \"{$host}\", copy the Merchant Secret for that domain, and set PAYHERE_MERCHANT_ID + PAYHERE_MERCHANT_SECRET (must match the same PayHere account; current merchant {$merchantId})."
        : 'PayHere did not accept the probe checkout. Verify merchant ID, secret, and domain approval.'),
  ];
}

// ---- Auth ----
if ($path === '/auth/register' && $method === 'POST') {
  $body = read_json_body();
  $email = strtolower(trim((string)($body['email'] ?? '')));
  $password = (string)($body['password'] ?? '');
  $displayName = trim((string)($body['displayName'] ?? ''));

  if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) json_response(400, ['error' => 'invalid_email']);
  if (strlen($password) < 8) json_response(400, ['error' => 'password_too_short']);
  if ($displayName === '') $displayName = 'User';

  $pdo = db();
  $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
  $stmt->execute([$email]);
  if ($stmt->fetch()) json_response(409, ['error' => 'email_taken']);

  $hash = password_hash($password, PASSWORD_DEFAULT);
  $ins = $pdo->prepare('INSERT INTO users (email, password_hash, display_name, role) VALUES (?, ?, ?, ?)');
  $ins->execute([$email, $hash, $displayName, 'organizer']);

  $userId = (int)$pdo->lastInsertId();
  regenerate_app_session();
  $_SESSION['user_id'] = $userId;
  issue_auth_cookie($userId);

  $payload = auth_success_payload($userId);
  $payload['authToken'] = issue_auth_token($userId);
  json_response(201, $payload);
}

if ($path === '/auth/register-attendee' && $method === 'POST') {
  $body = read_json_body();
  $email = strtolower(trim((string)($body['email'] ?? '')));
  $password = (string)($body['password'] ?? '');
  $displayName = trim((string)($body['displayName'] ?? ''));

  if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) json_response(400, ['error' => 'invalid_email']);
  if (strlen($password) < 8) json_response(400, ['error' => 'password_too_short']);
  if ($displayName === '') $displayName = 'Attendee';

  $pdo = db();
  $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
  $stmt->execute([$email]);
  if ($stmt->fetch()) json_response(409, ['error' => 'email_taken']);

  $hash = password_hash($password, PASSWORD_DEFAULT);
  $ins = $pdo->prepare('INSERT INTO users (email, password_hash, display_name, role) VALUES (?, ?, ?, ?)');
  $ins->execute([$email, $hash, $displayName, 'attendee']);

  $userId = (int)$pdo->lastInsertId();
  regenerate_app_session();
  $_SESSION['user_id'] = $userId;
  issue_auth_cookie($userId);

  $payload = auth_success_payload($userId);
  $payload['authToken'] = issue_auth_token($userId);
  json_response(201, $payload);
}

if ($path === '/auth/login' && $method === 'POST') {
  $body = read_json_body();
  $email = strtolower(trim((string)($body['email'] ?? '')));
  $password = (string)($body['password'] ?? '');

  if ($email === '' || $password === '') json_response(400, ['error' => 'missing_credentials']);

  try {
    $pdo = db();
    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    $row = $stmt->fetch();
  } catch (Throwable $e) {
    error_log(sprintf('[turnout][%s] auth/login db: %s', request_id(), $e->getMessage()));
    json_response(503, [
      'error' => 'db_unavailable',
      'requestId' => request_id(),
      'message' => 'Sign-in is temporarily unavailable because the database is unreachable. Please try again shortly.',
    ]);
  }
  if (!$row) json_response(401, ['error' => 'invalid_credentials', 'message' => 'Invalid email or password.']);
  $passwordHash = (string)($row['password_hash'] ?? '');
  if ($passwordHash === '' || !password_verify($password, $passwordHash)) {
    json_response(401, ['error' => 'invalid_credentials', 'message' => 'Invalid email or password.']);
  }
  if ((int)($row['is_blocked'] ?? 0) === 1) json_response(403, ['error' => 'user_blocked']);
  if (in_array((string)($row['status'] ?? 'active'), ['suspended', 'banned'], true)) json_response(403, ['error' => 'user_suspended']);

  $userId = (int)$row['id'];
  regenerate_app_session();
  $_SESSION['user_id'] = $userId;
  issue_auth_cookie($userId);

  // Logging should never block a successful auth response.
  try {
    write_log($pdo, $userId, (string)($row['role'] ?? 'unknown'), 'user.login', 'user', (string)$userId, null);
  } catch (Throwable $e) {}
  $token = issue_auth_token($userId);
  $payload = auth_success_payload($userId, ['forcePasswordReset' => boolish($row['force_password_reset'] ?? 0)]);
  $payload['authToken'] = $token;
  $payload['sessionToken'] = $token;
  json_response(200, $payload);
}

if ($path === '/auth/forgot-password' && $method === 'POST') {
  $body = read_json_body();
  $email = strtolower(trim((string)($body['email'] ?? '')));
  if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(400, ['error' => 'invalid_email']);
  }

  $pdo = db();
  $stmt = $pdo->prepare('SELECT id, is_blocked, status, password_hash FROM users WHERE email = ? LIMIT 1');
  $stmt->execute([$email]);
  $row = $stmt->fetch();
  if ($row) {
    $blocked = (int)($row['is_blocked'] ?? 0) === 1;
    $status = (string)($row['status'] ?? 'active');
    $hasPassword = trim((string)($row['password_hash'] ?? '')) !== '';
    if (!$blocked && !in_array($status, ['suspended', 'banned'], true) && $hasPassword) {
      $userId = (int)$row['id'];
      $token = issue_password_reset_token($userId);
      if ($token !== '') {
        send_password_reset_email($pdo, $email, $token);
      }
    }
  }

  json_response(200, [
    'ok' => true,
    'message' => 'If an account exists for that email, we sent a link to reset your password.',
  ]);
}

if ($path === '/auth/reset-password' && $method === 'POST') {
  $body = read_json_body();
  $token = trim((string)($body['token'] ?? ''));
  $password = (string)($body['password'] ?? '');
  if ($token === '') json_response(400, ['error' => 'missing_token']);
  if (strlen($password) < 8) json_response(400, ['error' => 'password_too_short']);

  $userId = password_reset_token_user_id($token);
  if ($userId === null) {
    json_response(400, ['error' => 'invalid_or_expired_token', 'message' => 'This reset link is invalid or has expired. Request a new one.']);
  }

  $pdo = db();
  $stmt = $pdo->prepare('SELECT id, is_blocked, status FROM users WHERE id = ? LIMIT 1');
  $stmt->execute([$userId]);
  $row = $stmt->fetch();
  if (!$row) json_response(400, ['error' => 'invalid_or_expired_token']);
  if ((int)($row['is_blocked'] ?? 0) === 1) json_response(403, ['error' => 'user_blocked']);
  if (in_array((string)($row['status'] ?? 'active'), ['suspended', 'banned'], true)) {
    json_response(403, ['error' => 'user_suspended']);
  }

  $hash = password_hash($password, PASSWORD_DEFAULT);
  $upd = $pdo->prepare('UPDATE users SET password_hash = ?, force_password_reset = 0 WHERE id = ?');
  $upd->execute([$hash, $userId]);

  try {
    write_log($pdo, $userId, 'user', 'user.password_reset', 'user', (string)$userId, null);
  } catch (Throwable $e) {}

  json_response(200, ['ok' => true, 'message' => 'Your password has been updated. You can sign in now.']);
}

if ($path === '/auth/logout' && $method === 'POST') {
  $_SESSION = [];
  if (session_status() === PHP_SESSION_ACTIVE) {
    session_destroy();
  }
  clear_auth_cookie();
  json_response(200, ['ok' => true]);
}

if ($path === '/auth/me' && $method === 'GET') {
  $uid = current_user_id();
  if ($uid === null) {
    json_response(401, ['error' => 'unauthorized', 'message' => 'Please sign in again.']);
  }
  $profile = load_user_profile($uid);
  if (($profile['isBlocked'] ?? false) === true) {
    $_SESSION = [];
    if (session_status() === PHP_SESSION_ACTIVE) session_destroy();
    clear_auth_cookie();
    json_response(403, ['error' => 'user_blocked']);
  }
  $status = (string)($profile['status'] ?? 'active');
  if (in_array($status, ['suspended', 'banned'], true)) {
    $_SESSION = [];
    if (session_status() === PHP_SESSION_ACTIVE) session_destroy();
    clear_auth_cookie();
    json_response(403, ['error' => 'user_suspended']);
  }
  json_response(200, ['user' => $profile]);
}

if ($path === '/me/profile' && $method === 'GET') {
  $uid = require_user_id();
  $pdo = db();
  ensure_user_profiles_table($pdo);

  $u = load_user_profile($uid);
  $stmt = $pdo->prepare('SELECT avatar_url, phone, bio FROM user_profiles WHERE user_id = ? LIMIT 1');
  $stmt->execute([$uid]);
  $row = $stmt->fetch();

  json_response(200, [
    'profile' => [
      'displayName' => $u['displayName'],
      'email' => $u['email'],
      'avatarUrl' => $row['avatar_url'] ?? null,
      'phone' => $row['phone'] ?? null,
      'bio' => $row['bio'] ?? null,
    ],
  ]);
}

if ($path === '/me/profile' && $method === 'POST') {
  $uid = require_user_id();
  $body = read_json_body();
  $displayName = trim((string)($body['displayName'] ?? ''));
  $avatarUrl = trim((string)($body['avatarUrl'] ?? ''));
  $phone = trim((string)($body['phone'] ?? ''));
  $bio = trim((string)($body['bio'] ?? ''));

  if ($displayName === '') json_response(400, ['error' => 'invalid_display_name']);
  if ($avatarUrl !== '' && !filter_var($avatarUrl, FILTER_VALIDATE_URL)) json_response(400, ['error' => 'invalid_avatar_url']);

  $pdo = db();
  ensure_user_profiles_table($pdo);

  $updUser = $pdo->prepare('UPDATE users SET display_name = ? WHERE id = ?');
  $updUser->execute([$displayName, $uid]);

  $upsert = $pdo->prepare(
    'INSERT INTO user_profiles (user_id, avatar_url, phone, bio, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET
       avatar_url = excluded.avatar_url,
       phone = excluded.phone,
       bio = excluded.bio,
       updated_at = CURRENT_TIMESTAMP'
  );
  try {
    $upsert->execute([
      $uid,
      $avatarUrl !== '' ? $avatarUrl : null,
      $phone !== '' ? $phone : null,
      $bio !== '' ? $bio : null,
    ]);
  } catch (Throwable $e) {
    // MySQL fallback (ON CONFLICT is SQLite-specific)
    $mysqlUpsert = $pdo->prepare(
      'INSERT INTO user_profiles (user_id, avatar_url, phone, bio)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         avatar_url = VALUES(avatar_url),
         phone = VALUES(phone),
         bio = VALUES(bio)'
    );
    $mysqlUpsert->execute([
      $uid,
      $avatarUrl !== '' ? $avatarUrl : null,
      $phone !== '' ? $phone : null,
      $bio !== '' ? $bio : null,
    ]);
  }

  json_response(200, ['ok' => true, 'user' => load_user_profile($uid)]);
}

if ($path === '/me/organizer-workspace' && $method === 'GET') {
  $uid = require_organizer_user_id();
  $pdo = db();
  $ctx = organizer_workspace_context($pdo, $uid);
  $ownerUserId = (int)$ctx['ownerUserId'];
  json_response(200, [
    'workspace' => $ctx,
    'profile' => organizer_profile_api_shape($pdo, $ownerUserId),
  ]);
}

if ($path === '/me/organizer-profile' && $method === 'GET') {
  $uid = require_organizer_user_id();
  $pdo = db();
  $ctx = organizer_workspace_context($pdo, $uid);
  if (!($ctx['isOwner'] ?? false)) {
    json_response(403, ['error' => 'forbidden', 'message' => 'Only the workspace owner can edit organization profile.']);
  }
  json_response(200, ['profile' => organizer_profile_api_shape($pdo, $uid)]);
}

if ($path === '/me/organizer-profile' && $method === 'POST') {
  $uid = require_organizer_user_id();
  $pdo = db();
  $ctx = organizer_workspace_context($pdo, $uid);
  if (!($ctx['isOwner'] ?? false)) {
    json_response(403, ['error' => 'forbidden', 'message' => 'Only the workspace owner can edit organization profile.']);
  }
  $body = read_json_body();
  $organizationName = trim((string)($body['organizationName'] ?? ''));
  $logoUrl = trim((string)($body['logoUrl'] ?? ''));
  $website = trim((string)($body['website'] ?? ''));
  $phone = trim((string)($body['phone'] ?? ''));
  $displayName = trim((string)($body['displayName'] ?? ''));
  $businessAddress = trim((string)($body['businessAddress'] ?? ''));
  $businessRegistrationNo = trim((string)($body['businessRegistrationNo'] ?? ''));
  $bankAccountHolderName = trim((string)($body['bankAccountHolderName'] ?? ''));
  $bankName = trim((string)($body['bankName'] ?? ''));
  $bankBranch = trim((string)($body['bankBranch'] ?? ''));
  $bankAccountNumber = trim((string)($body['bankAccountNumber'] ?? ''));

  if ($organizationName === '') {
    $existingProfile = load_organizer_profile_row($pdo, $uid);
    $organizationName = trim((string)($existingProfile['organization_name'] ?? ''));
  }
  if ($organizationName === '') json_response(400, ['error' => 'invalid_organization_name']);
  if ($logoUrl !== '' && !filter_var($logoUrl, FILTER_VALIDATE_URL) && !str_starts_with($logoUrl, '/api/uploads/organizer-logos/')) {
    json_response(400, ['error' => 'invalid_logo_url']);
  }
  if ($website !== '' && !filter_var($website, FILTER_VALIDATE_URL)) {
    json_response(400, ['error' => 'invalid_website']);
  }
  if ($displayName !== '') {
    $pdo->prepare('UPDATE users SET display_name = ? WHERE id = ?')->execute([$displayName, $uid]);
  }

  upsert_organizer_profile_paid_event_fields($pdo, $uid, [
    'organization_name' => $organizationName,
    'logo_url' => $logoUrl,
    'website' => $website,
    'phone' => $phone,
    'business_address' => $businessAddress,
    'business_registration_no' => $businessRegistrationNo,
    'bank_account_holder_name' => $bankAccountHolderName,
    'bank_name' => $bankName,
    'bank_branch' => $bankBranch,
    'bank_account_number' => $bankAccountNumber,
  ]);

  json_response(200, ['ok' => true, 'profile' => organizer_profile_api_shape($pdo, $uid), 'user' => load_user_profile($uid)]);
}

if ($path === '/organizer/paid-event-readiness' && $method === 'GET') {
  $uid = require_organizer_user_id();
  $pdo = db();
  $ctx = organizer_workspace_context($pdo, $uid);
  $ownerUserId = (int)($ctx['ownerUserId'] ?? $uid);
  json_response(200, ['readiness' => organizer_paid_event_readiness_api_shape($pdo, $ownerUserId)]);
}

if ($path === '/organizer/payment-settings' && $method === 'GET') {
  $uid = require_organizer_user_id();
  $pdo = db();
  $ctx = organizer_workspace_context($pdo, $uid);
  $ownerUserId = (int)($ctx['ownerUserId'] ?? $uid);
  json_response(200, [
    'settings' => organizer_payment_settings_api_shape($pdo, $ownerUserId),
    'readiness' => organizer_paid_event_readiness_api_shape($pdo, $ownerUserId),
  ]);
}

if ($path === '/organizer/payment-settings' && $method === 'POST') {
  $uid = require_organizer_user_id();
  $pdo = db();
  $ctx = organizer_workspace_context($pdo, $uid);
  if (!($ctx['isOwner'] ?? false)) {
    json_response(403, ['error' => 'forbidden', 'message' => 'Only the workspace owner can manage payment settings.']);
  }
  $ownerUserId = (int)($ctx['ownerUserId'] ?? $uid);
  $body = read_json_body();
  $gatewayMode = normalize_organizer_gateway_mode((string)($body['gatewayMode'] ?? 'turnout'));
  $fields = ['gateway_mode' => $gatewayMode];
  if ($gatewayMode === 'own_payhere') {
    $fields['payhere_merchant_id'] = trim((string)($body['ownPayhereMerchantId'] ?? ''));
    if (array_key_exists('ownPayhereMerchantSecret', $body)) {
      $fields['payhere_merchant_secret'] = trim((string)$body['ownPayhereMerchantSecret']);
    }
  }
  upsert_organizer_payment_settings($pdo, $ownerUserId, $fields);

  $bankFields = [];
  if (array_key_exists('bankAccountHolderName', $body)) {
    $bankFields['bank_account_holder_name'] = trim((string)$body['bankAccountHolderName']);
  }
  if (array_key_exists('bankName', $body)) {
    $bankFields['bank_name'] = trim((string)$body['bankName']);
  }
  if (array_key_exists('bankBranch', $body)) {
    $bankFields['bank_branch'] = trim((string)$body['bankBranch']);
  }
  if (array_key_exists('bankAccountNumber', $body)) {
    $bankFields['bank_account_number'] = trim((string)$body['bankAccountNumber']);
  }
  if ($bankFields !== []) {
    upsert_organizer_profile_paid_event_fields($pdo, $ownerUserId, $bankFields);
  }

  json_response(200, [
    'ok' => true,
    'settings' => organizer_payment_settings_api_shape($pdo, $ownerUserId),
    'readiness' => organizer_paid_event_readiness_api_shape($pdo, $ownerUserId),
  ]);
}

if ($path === '/organizer/billing/preapprove' && $method === 'POST') {
  $uid = require_organizer_user_id();
  $pdo = db();
  $ctx = organizer_workspace_context($pdo, $uid);
  if (!($ctx['isOwner'] ?? false)) {
    json_response(403, ['error' => 'forbidden', 'message' => 'Only the workspace owner can add a billing card.']);
  }
  $ownerUserId = (int)($ctx['ownerUserId'] ?? $uid);

  $profile = load_user_profile($ownerUserId);
  $email = trim((string)($profile['email'] ?? ''));
  $displayName = trim((string)($profile['displayName'] ?? 'Organizer'));
  if ($email === '') json_response(400, ['error' => 'missing_email']);

  $cfg = payhere_cfg();
  $setupOrderId = organizer_billing_setup_order_id($ownerUserId);
  create_organizer_billing_session($pdo, $ownerUserId, $setupOrderId);

  set_organizer_billing_setup_status($pdo, $ownerUserId, 'pending');

  $firstName = explode(' ', $displayName)[0] ?: 'Organizer';
  $lastName = trim(substr($displayName, strlen($firstName))) ?: ' ';
  $returnUrl = $cfg['app_base_url'] . '/organizer/billing/return?setup_order_id=' . rawurlencode($setupOrderId);
  $cancelUrl = $cfg['app_base_url'] . '/organizer/billing/cancel?setup_order_id=' . rawurlencode($setupOrderId);
  $notifyUrl = $cfg['app_base_url'] . '/api/organizer/billing/notify';

  $preapprove = payhere_preapprove_payment(
    $cfg,
    $cfg['merchant_id'],
    $cfg['merchant_secret'],
    $setupOrderId,
    'Turnout platform billing verification',
    $firstName,
    $lastName,
    $email,
    '0770000000',
    $returnUrl,
    $cancelUrl,
    $notifyUrl
  );

  $actionUrl = $cfg['sandbox']
    ? 'https://sandbox.payhere.lk/pay/preapprove'
    : 'https://www.payhere.lk/pay/preapprove';

  json_response(200, [
    'setupOrderId' => $setupOrderId,
    'actionUrl' => $actionUrl,
    'sandbox' => $cfg['sandbox'],
    'hash' => $preapprove['hash'],
    'fields' => $preapprove,
    'sdkPayment' => $preapprove,
  ]);
}

if ($path === '/organizer/billing/status' && $method === 'GET') {
  $uid = require_organizer_user_id();
  $pdo = db();
  $ctx = organizer_workspace_context($pdo, $uid);
  $ownerUserId = (int)($ctx['ownerUserId'] ?? $uid);
  $setupOrderId = trim((string)($_GET['setup_order_id'] ?? ''));
  if ($setupOrderId === '') {
    json_response(200, ['settings' => organizer_payment_settings_api_shape($pdo, $ownerUserId)]);
  }

  ensure_organizer_payment_tables($pdo);
  $stmt = $pdo->prepare('SELECT status FROM organizer_billing_sessions WHERE setup_order_id = ? AND user_id = ? LIMIT 1');
  $stmt->execute([$setupOrderId, $ownerUserId]);
  $session = $stmt->fetch();
  $sessionStatus = is_array($session) ? (string)$session['status'] : 'pending';

  json_response(200, [
    'sessionStatus' => $sessionStatus,
    'settings' => organizer_payment_settings_api_shape($pdo, $ownerUserId),
  ]);
}

if ($path === '/organizer/billing/notify' && $method === 'POST') {
  $merchantId = (string)($_POST['merchant_id'] ?? '');
  $orderId = (string)($_POST['order_id'] ?? '');
  $payhereAmount = (string)($_POST['payhere_amount'] ?? '');
  $payhereCurrency = (string)($_POST['payhere_currency'] ?? '');
  $statusCode = (string)($_POST['status_code'] ?? '');
  $md5sig = (string)($_POST['md5sig'] ?? '');

  if ($merchantId === '' || $orderId === '' || $statusCode === '' || $md5sig === '') {
    http_response_code(400);
    echo 'bad_request';
    exit;
  }

  $pdo = db();
  $cfg = resolve_payhere_cfg_by_merchant_id($pdo, $merchantId);
  if ($cfg === null) {
    http_response_code(403);
    echo 'forbidden';
    exit;
  }

  $localMd5sig = payhere_local_md5sig(
    $merchantId,
    $orderId,
    $payhereAmount,
    $payhereCurrency,
    $statusCode,
    $cfg['merchant_secret']
  );
  if (!payhere_notify_signature_valid($localMd5sig, $md5sig)) {
    http_response_code(403);
    echo 'invalid_signature';
    exit;
  }

  if (!str_starts_with($orderId, 'bill')) {
    http_response_code(400);
    echo 'invalid_order';
    exit;
  }

  if (!preg_match('/^bill(\d+)t\d+$/', $orderId, $m)) {
    http_response_code(400);
    echo 'invalid_order';
    exit;
  }
  $userId = (int)$m[1];
  complete_organizer_billing_session($pdo, $userId, $orderId, $_POST);
  http_response_code(200);
  echo 'ok';
  exit;
}

if ($path === '/organizer/team' && $method === 'GET') {
  $uid = require_organizer_user_id();
  $pdo = db();
  $ctx = organizer_workspace_context($pdo, $uid);
  $ownerUserId = (int)$ctx['ownerUserId'];
  if (!($ctx['canManageTeam'] ?? false)) {
    json_response(403, ['error' => 'forbidden']);
  }

  $members = [];
  $ownerProfile = load_user_profile($ownerUserId);
  $members[] = [
    'id' => 'owner',
    'memberUserId' => (string)$ownerUserId,
    'displayName' => (string)($ownerProfile['displayName'] ?? ''),
    'email' => (string)($ownerProfile['email'] ?? ''),
    'role' => 'owner',
    'createdAt' => null,
    'isOwner' => true,
  ];

  $stmt = $pdo->prepare(
    'SELECT m.id, m.member_user_id, m.role, m.created_at, u.display_name, u.email
     FROM organizer_team_members m
     JOIN users u ON u.id = m.member_user_id
     WHERE m.owner_user_id = ?
     ORDER BY m.created_at ASC'
  );
  $stmt->execute([$ownerUserId]);
  while ($row = $stmt->fetch()) {
    $members[] = [
      'id' => (string)$row['id'],
      'memberUserId' => (string)$row['member_user_id'],
      'displayName' => (string)$row['display_name'],
      'email' => (string)$row['email'],
      'role' => normalize_organizer_team_role((string)$row['role']),
      'createdAt' => gmdate('c', strtotime($row['created_at'])),
      'isOwner' => false,
    ];
  }

  $invStmt = $pdo->prepare(
    "SELECT id, email, role, status, expires_at, created_at
     FROM organizer_invites
     WHERE owner_user_id = ? AND status = 'pending' AND expires_at > CURRENT_TIMESTAMP
     ORDER BY created_at DESC"
  );
  $invStmt->execute([$ownerUserId]);
  $invites = [];
  while ($inv = $invStmt->fetch()) {
    $invites[] = [
      'id' => (string)$inv['id'],
      'email' => (string)$inv['email'],
      'role' => normalize_organizer_team_role((string)$inv['role']),
      'status' => (string)$inv['status'],
      'expiresAt' => gmdate('c', strtotime($inv['expires_at'])),
      'createdAt' => gmdate('c', strtotime($inv['created_at'])),
    ];
  }

  json_response(200, ['members' => $members, 'invites' => $invites, 'workspace' => $ctx]);
}

if ($path === '/organizer/team/invite' && $method === 'POST') {
  $uid = require_organizer_user_id();
  $pdo = db();
  $ctx = organizer_workspace_context($pdo, $uid);
  $ownerUserId = (int)$ctx['ownerUserId'];
  if (!($ctx['canManageTeam'] ?? false)) {
    json_response(403, ['error' => 'forbidden']);
  }
  $body = read_json_body();
  $email = strtolower(trim((string)($body['email'] ?? '')));
  $role = normalize_organizer_team_role((string)($body['role'] ?? 'editor'));
  if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(400, ['error' => 'invalid_email']);
  }

  $ownerProfile = load_user_profile($ownerUserId);
  if (strtolower((string)($ownerProfile['email'] ?? '')) === $email) {
    json_response(400, ['error' => 'cannot_invite_owner']);
  }

  $existingUser = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
  $existingUser->execute([$email]);
  $existingRow = $existingUser->fetch();
  if ($existingRow) {
    $memberId = (int)$existingRow['id'];
    $dup = $pdo->prepare('SELECT id FROM organizer_team_members WHERE owner_user_id = ? AND member_user_id = ? LIMIT 1');
    $dup->execute([$ownerUserId, $memberId]);
    if ($dup->fetch()) {
      json_response(400, ['error' => 'already_member']);
    }
  }

  $pdo->prepare(
    "UPDATE organizer_invites SET status = 'revoked' WHERE owner_user_id = ? AND email = ? AND status = 'pending'"
  )->execute([$ownerUserId, $email]);

  $token = bin2hex(random_bytes(16));
  $expiresAt = gmdate('Y-m-d H:i:s', time() + 7 * 86400);
  $ins = $pdo->prepare(
    'INSERT INTO organizer_invites (owner_user_id, email, role, token, invited_by_user_id, status, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  $ins->execute([$ownerUserId, $email, $role, $token, $uid, 'pending', $expiresAt]);

  $org = load_organizer_profile_row($pdo, $ownerUserId);
  $orgName = (string)($org['organization_name'] ?? $ownerProfile['displayName'] ?? '');
  send_organizer_team_invite_email(
    $pdo,
    $email,
    (string)($ownerProfile['displayName'] ?? 'An organizer'),
    $orgName,
    $role,
    $token
  );

  json_response(201, ['ok' => true, 'token' => $token]);
}

if (preg_match('#^/organizer/team/members/(\\d+)$#', $path, $m) && $method === 'DELETE') {
  $uid = require_organizer_user_id();
  $pdo = db();
  $ctx = organizer_workspace_context($pdo, $uid);
  $ownerUserId = (int)$ctx['ownerUserId'];
  if (!($ctx['isOwner'] ?? false)) {
    json_response(403, ['error' => 'forbidden']);
  }
  $memberId = (int)$m[1];
  if ($memberId === $ownerUserId) json_response(400, ['error' => 'cannot_remove_owner']);
  $del = $pdo->prepare('DELETE FROM organizer_team_members WHERE owner_user_id = ? AND member_user_id = ?');
  $del->execute([$ownerUserId, $memberId]);
  json_response(200, ['ok' => true]);
}

if (preg_match('#^/organizer/team/invites/(\\d+)$#', $path, $m) && $method === 'DELETE') {
  $uid = require_organizer_user_id();
  $pdo = db();
  $ctx = organizer_workspace_context($pdo, $uid);
  $ownerUserId = (int)$ctx['ownerUserId'];
  if (!($ctx['canManageTeam'] ?? false)) {
    json_response(403, ['error' => 'forbidden']);
  }
  $inviteId = (int)$m[1];
  $pdo->prepare(
    "UPDATE organizer_invites SET status = 'revoked' WHERE id = ? AND owner_user_id = ?"
  )->execute([$inviteId, $ownerUserId]);
  json_response(200, ['ok' => true]);
}

if ($path === '/organizer/invites/accept' && $method === 'POST') {
  $uid = require_organizer_user_id();
  $pdo = db();
  $body = read_json_body();
  $token = trim((string)($body['token'] ?? ''));
  if ($token === '') json_response(400, ['error' => 'missing_token']);

  $stmt = $pdo->prepare(
    "SELECT * FROM organizer_invites WHERE token = ? AND status = 'pending' LIMIT 1"
  );
  $stmt->execute([$token]);
  $invite = $stmt->fetch();
  if (!$invite) json_response(404, ['error' => 'invite_not_found']);
  if (strtotime((string)$invite['expires_at']) < time()) {
    json_response(400, ['error' => 'invite_expired']);
  }

  $user = load_user_profile($uid);
  $inviteEmail = strtolower((string)$invite['email']);
  if (strtolower((string)($user['email'] ?? '')) !== $inviteEmail) {
    json_response(403, ['error' => 'invite_email_mismatch', 'message' => 'Sign in with the email address that received the invite.']);
  }

  $ownerUserId = (int)$invite['owner_user_id'];
  $role = normalize_organizer_team_role((string)$invite['role']);
  $pdo->beginTransaction();
  try {
    $pdo->prepare('DELETE FROM organizer_team_members WHERE owner_user_id = ? AND member_user_id = ?')->execute([$ownerUserId, $uid]);
    $ins = $pdo->prepare('INSERT INTO organizer_team_members (owner_user_id, member_user_id, role) VALUES (?, ?, ?)');
    $ins->execute([$ownerUserId, $uid, $role]);
    $pdo->prepare("UPDATE organizer_invites SET status = 'accepted' WHERE id = ?")->execute([(int)$invite['id']]);
    $pdo->commit();
  } catch (Throwable $e) {
    $pdo->rollBack();
    json_response(400, ['error' => 'accept_failed']);
  }

  json_response(200, ['ok' => true, 'workspace' => organizer_workspace_context($pdo, $uid)]);
}

if ($path === '/organizer/invites/preview' && $method === 'GET') {
  $token = trim((string)($_GET['token'] ?? ''));
  if ($token === '') json_response(400, ['error' => 'missing_token']);
  $pdo = db();
  $stmt = $pdo->prepare(
    "SELECT i.email, i.role, i.expires_at, i.status, p.organization_name, u.display_name AS owner_name
     FROM organizer_invites i
     JOIN users u ON u.id = i.owner_user_id
     LEFT JOIN organizer_profiles p ON p.user_id = i.owner_user_id
     WHERE i.token = ? LIMIT 1"
  );
  $stmt->execute([$token]);
  $row = $stmt->fetch();
  if (!$row) json_response(404, ['error' => 'invite_not_found']);
  json_response(200, [
    'invite' => [
      'email' => (string)$row['email'],
      'role' => normalize_organizer_team_role((string)$row['role']),
      'status' => (string)$row['status'],
      'expiresAt' => gmdate('c', strtotime($row['expires_at'])),
      'organizationName' => (string)($row['organization_name'] ?? $row['owner_name'] ?? ''),
      'ownerName' => (string)($row['owner_name'] ?? ''),
    ],
  ]);
}

if ($path === '/me/password' && $method === 'POST') {
  $uid = require_user_id();
  $body = read_json_body();
  $currentPassword = (string)($body['currentPassword'] ?? '');
  $newPassword = (string)($body['newPassword'] ?? '');

  if ($currentPassword === '' || $newPassword === '') json_response(400, ['error' => 'missing_password_fields']);
  if (strlen($newPassword) < 8) json_response(400, ['error' => 'password_too_short']);

  $pdo = db();
  $stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = ? LIMIT 1');
  $stmt->execute([$uid]);
  $row = $stmt->fetch();
  if (!$row) json_response(401, ['error' => 'unauthorized']);
  if (!password_verify($currentPassword, $row['password_hash'])) json_response(400, ['error' => 'invalid_current_password']);
  if (password_verify($newPassword, $row['password_hash'])) json_response(400, ['error' => 'password_same_as_current']);

  $newHash = password_hash($newPassword, PASSWORD_DEFAULT);
  $upd = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
  $upd->execute([$newHash, $uid]);

  json_response(200, ['ok' => true]);
}

// ---- PayHere Checkout API ----
if ($path === '/payhere/initiate' && $method === 'POST') {
  $body = read_json_body();
  $eventId = (int)($body['eventId'] ?? 0);
  $buyerName = trim((string)($body['buyerName'] ?? ''));
  $buyerPhone = trim((string)($body['buyerPhone'] ?? ''));
  $buyerEmail = strtolower(trim((string)($body['buyerEmail'] ?? '')));
  $items = $body['tickets'] ?? [];
  $attendees = $body['attendees'] ?? [];

  if ($eventId <= 0) json_response(400, ['error' => 'invalid_event']);
  if ($buyerEmail === '' || !filter_var($buyerEmail, FILTER_VALIDATE_EMAIL)) json_response(400, ['error' => 'invalid_buyer_email']);
  if (!is_array($items) || count($items) < 1) json_response(400, ['error' => 'invalid_order_items']);
  if (!is_array($attendees) || count($attendees) < 1) json_response(400, ['error' => 'invalid_attendees']);

  $pdo = db();
  ensure_payhere_tables($pdo);

  $ev = require_publishable_event($pdo, $eventId);

  $normalized = normalize_order_items_from_db($pdo, $eventId, $items);
  $checkoutFields = checkout_fields_from_event_row($ev);
  validate_attendees_for_order($normalized['items'], $attendees, $checkoutFields);
  $totalCents = (int)$normalized['totalCents'];
  $normalizedItems = $normalized['items'];

  if ($totalCents <= 0) {
    json_response(400, ['error' => 'payhere_requires_positive_amount']);
  }

  $buyerId = current_user_id();
  $pdo->beginTransaction();
  try {
    $ins = $pdo->prepare('INSERT INTO orders (event_id, buyer_user_id, buyer_name, buyer_phone, buyer_email, tickets_json, total_amount_cents, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $ins->execute([
      $eventId,
      $buyerId,
      $buyerName !== '' ? $buyerName : null,
      $buyerPhone !== '' ? $buyerPhone : null,
      $buyerEmail,
      json_encode($normalizedItems, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
      $totalCents,
      'pending',
    ]);
    $orderId = (int)$pdo->lastInsertId();

    $attInsert = $pdo->prepare('INSERT INTO order_attendee_requests (order_id, attendees_json) VALUES (?, ?)');
    $attInsert->execute([
      $orderId,
      json_encode($attendees, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
    ]);
    upsert_transaction($pdo, $eventId, $buyerId, $orderId, $totalCents, 'pending', null);

    $pdo->commit();
  } catch (Exception $e) {
    $pdo->rollBack();
    json_response(400, ['error' => 'payhere_initiate_failed']);
  }

  $accessToken = issue_order_access_token($orderId);

  $organizerUserId = (int)($ev['organizer_user_id'] ?? 0);
  if ($organizerUserId <= 0) {
    json_response(400, ['error' => 'invalid_event_organizer']);
  }
  $cfg = payhere_cfg_for_organizer($pdo, $organizerUserId);
  $merchantId = $cfg['merchant_id'];
  $merchantSecret = $cfg['merchant_secret'];
  $currency = 'LKR';
  $orderIdStr = (string)$orderId;
  $actionUrl = $cfg['sandbox'] ? 'https://sandbox.payhere.lk/pay/checkout' : 'https://www.payhere.lk/pay/checkout';
  $returnUrl = $cfg['app_base_url'] . '/payhere/return?order_id=' . rawurlencode($orderIdStr) . '&token=' . rawurlencode($accessToken);
  $cancelUrl = $cfg['app_base_url'] . '/payhere/cancel?order_id=' . rawurlencode($orderIdStr) . '&token=' . rawurlencode($accessToken);

  // Best-effort name split
  $firstName = $buyerName !== '' ? explode(' ', $buyerName)[0] : 'Customer';
  $lastName = $buyerName !== '' ? trim(substr($buyerName, strlen($firstName))) : '';
  if ($lastName === '') $lastName = ' ';

  $checkout = payhere_checkout_payment(
    $cfg,
    $merchantId,
    $merchantSecret,
    $orderIdStr,
    $totalCents,
    $currency,
    (string)$ev['title'],
    $firstName,
    $lastName,
    $buyerEmail,
    $buyerPhone !== '' ? $buyerPhone : '0000000000',
    $returnUrl,
    $cancelUrl
  );

  json_response(200, [
    'orderId' => $orderIdStr,
    'accessToken' => $accessToken,
    'actionUrl' => $actionUrl,
    'sandbox' => $cfg['sandbox'],
    'hash' => $checkout['hash'],
    'fields' => $checkout,
    'sdkPayment' => $checkout,
  ]);
}

if (preg_match('#^/payhere/status/(\\d+)$#', $path, $m) && $method === 'GET') {
  $orderId = (int)$m[1];
  $accessToken = trim((string)($_GET['token'] ?? ''));
  if ($accessToken === '') {
    json_response(400, ['error' => 'missing_token', 'message' => 'Missing checkout token. Close checkout and try again.']);
  }
  if (order_access_token_payload($accessToken, $orderId) === null) {
    json_response(403, ['error' => 'forbidden', 'message' => 'Invalid or expired checkout session.']);
  }

  $pdo = db();
  payhere_sync_order_from_transactions($pdo, $orderId);

  $stmt = $pdo->prepare('SELECT id, status FROM orders WHERE id = ? LIMIT 1');
  $stmt->execute([$orderId]);
  $row = $stmt->fetch();
  if (!$row) {
    json_response(404, ['error' => 'order_not_found']);
  }

  json_response(200, [
    'order' => [
      'id' => (string)$row['id'],
      'status' => (string)$row['status'],
    ],
  ]);
}

if ($path === '/payhere/notify' && $method === 'POST') {
  // PayHere sends application/x-www-form-urlencoded (not JSON).
  $merchantId = (string)($_POST['merchant_id'] ?? '');
  $orderId = (string)($_POST['order_id'] ?? '');
  $paymentId = (string)($_POST['payment_id'] ?? '');
  $payhereAmount = (string)($_POST['payhere_amount'] ?? '');
  $payhereCurrency = (string)($_POST['payhere_currency'] ?? '');
  $statusCode = (string)($_POST['status_code'] ?? '');
  $md5sig = (string)($_POST['md5sig'] ?? '');
  $methodSel = (string)($_POST['method'] ?? '');
  $statusMessage = (string)($_POST['status_message'] ?? '');

  if ($merchantId === '' || $orderId === '' || $statusCode === '' || $md5sig === '') {
    http_response_code(400);
    echo 'bad_request';
    exit;
  }

  $pdo = db();
  $cfg = resolve_payhere_cfg_by_merchant_id($pdo, $merchantId);
  if ($cfg === null) {
    http_response_code(403);
    echo 'forbidden';
    exit;
  }

  // Verify md5sig before trusting any payment status (PayHere security requirement).
  $localMd5sig = payhere_local_md5sig(
    $merchantId,
    $orderId,
    $payhereAmount,
    $payhereCurrency,
    $statusCode,
    $cfg['merchant_secret']
  );
  if (!payhere_notify_signature_valid($localMd5sig, $md5sig)) {
    http_response_code(403);
    echo 'invalid_signature';
    exit;
  }

  ensure_payhere_tables($pdo);

  // Log transaction (idempotent enough for MVP)
  $rawJson = json_encode($_POST, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  $txIns = $pdo->prepare('INSERT INTO payhere_transactions (order_id, payment_id, status_code, payhere_amount, payhere_currency, method, status_message, raw_post_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  $txIns->execute([(int)$orderId, $paymentId !== '' ? $paymentId : null, $statusCode, $payhereAmount !== '' ? $payhereAmount : null, $payhereCurrency !== '' ? $payhereCurrency : null, $methodSel !== '' ? $methodSel : null, $statusMessage !== '' ? $statusMessage : null, $rawJson]);

  // Update order status
  $status = 'pending';
  if ($statusCode === '2') $status = 'paid';
  if ($statusCode === '-1') $status = 'failed';
  if ($statusCode === '-2' || $statusCode === '-3') $status = 'failed';

  $pdo->beginTransaction();
  try {
    $curStmt = $pdo->prepare('SELECT status FROM orders WHERE id = ? LIMIT 1');
    $curStmt->execute([(int)$orderId]);
    $cur = $curStmt->fetch();
    if (!$cur) {
      $pdo->rollBack();
      http_response_code(404);
      echo 'order_not_found';
      exit;
    }
    $currentStatus = (string)$cur['status'];
    $nextStatus = $status;
    if ($currentStatus === 'paid') $nextStatus = 'paid';

    $upd = $pdo->prepare('UPDATE orders SET status = ? WHERE id = ?');
    $upd->execute([$nextStatus, (int)$orderId]);

    if ($nextStatus === 'paid') {
      payhere_fulfill_paid_order(
        $pdo,
        (int)$orderId,
        $paymentId !== '' ? $paymentId : null,
        $payhereAmount !== '' ? $payhereAmount : null
      );
    } else {
      $o = $pdo->prepare('SELECT event_id, buyer_user_id, total_amount_cents FROM orders WHERE id = ? LIMIT 1');
      $o->execute([(int)$orderId]);
      $orderRow = $o->fetch();
      if ($orderRow) {
        upsert_transaction(
          $pdo,
          (int)$orderRow['event_id'],
          $orderRow['buyer_user_id'] !== null ? (int)$orderRow['buyer_user_id'] : null,
          (int)$orderId,
          (int)$orderRow['total_amount_cents'],
          $nextStatus,
          $paymentId !== '' ? $paymentId : null
        );
      }
    }

    $pdo->commit();
  } catch (Exception $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo 'server_error';
    exit;
  }

  // PayHere expects 200 OK without echoing sensitive info
  http_response_code(200);
  echo 'ok';
  exit;
}

// Demo seed route removed for production hardening.

// ---- Events ----
if ($path === '/events' && $method === 'GET') {
  $uid = require_organizer_user_id();
  $pdo = db();
  $ownerIds = organizer_accessible_owner_ids($pdo, $uid);
  $placeholders = implode(',', array_fill(0, count($ownerIds), '?'));
  $stmt = $pdo->prepare("SELECT * FROM events WHERE organizer_user_id IN ($placeholders) ORDER BY created_at DESC");
  $stmt->execute($ownerIds);
  $events = [];
  while ($row = $stmt->fetch()) {
    $events[] = [
      'id' => (string)$row['id'],
      'slug' => $row['slug'],
      'organizerId' => (string)$row['organizer_user_id'],
      'title' => $row['title'],
      'description' => $row['description'],
      'date' => gmdate('c', strtotime($row['event_date'])),
      'location' => $row['location'],
      'bannerUrl' => $row['banner_url'],
      'templateId' => $row['template_id'],
      'customization' => json_decode($row['customization_json'], true),
      'status' => $row['status'],
      'createdAt' => gmdate('c', strtotime($row['created_at'])),
    ];
  }
  json_response(200, ['events' => $events]);
}

if ($path === '/events' && $method === 'POST') {
  $uid = require_organizer_user_id();
  $body = read_json_body();

  $requestedSlug = trim((string)($body['slug'] ?? ''));
  $title = trim((string)($body['title'] ?? ''));
  $description = trim((string)($body['description'] ?? ''));
  $date = (string)($body['date'] ?? '');
  $location = trim((string)($body['location'] ?? ''));
  $bannerUrl = (string)($body['bannerUrl'] ?? '');
  $templateId = (string)($body['templateId'] ?? 'template-2');
  $tickets = $body['tickets'] ?? [];

  if ($title === '' || strlen($title) < 3) json_response(400, ['error' => 'invalid_title']);
  if ($description === '' || strlen($description) < 10) json_response(400, ['error' => 'invalid_description']);
  if ($date === '') json_response(400, ['error' => 'invalid_date']);
  if ($location === '') json_response(400, ['error' => 'invalid_location']);
  if (!is_array($tickets) || count($tickets) < 1) json_response(400, ['error' => 'invalid_tickets']);

  $customization = $body['customization'] ?? null;
  if (!is_array($customization)) {
    $customization = [
      'primaryColor' => '#4f46e5',
      'secondaryColor' => '#10b981',
      'fontFamily' => 'Inter',
      'heroText' => $title,
      'heroSubtext' => mb_substr($description, 0, 100),
      'layout' => 'standard',
    ];
  }

  $pdo = db();
  $eventOwnerId = resolve_event_owner_for_create($pdo, $uid);
  if ($eventOwnerId !== $uid) {
    $teamRole = organizer_team_role_for_owner($pdo, $uid, $eventOwnerId);
    if ($teamRole === null || organizer_role_rank($teamRole) < organizer_role_rank('editor')) {
      json_response(403, ['error' => 'forbidden']);
    }
  }
  assert_organizer_can_sell_paid_ticket_list($pdo, $eventOwnerId, $tickets);
  $baseSlug = $requestedSlug !== '' ? slugify($requestedSlug) : slugify($title);
  $slug = unique_slug($pdo, $baseSlug);
  $pdo->beginTransaction();
  try {
    $ins = $pdo->prepare('INSERT INTO events (organizer_user_id, slug, title, description, event_date, location, banner_url, template_id, customization_json, status, event_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $ins->execute([
      $eventOwnerId,
      $slug,
      $title,
      $description,
      date('Y-m-d H:i:s', strtotime($date)),
      $location,
      $bannerUrl !== '' ? $bannerUrl : 'https://picsum.photos/seed/' . time() . '/1200/600',
      $templateId,
      json_encode($customization, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
      'published',
      'approved',
    ]);
    $eventId = (int)$pdo->lastInsertId();

    $ticketIns = $pdo->prepare('INSERT INTO tickets (event_id, name, price_cents, quantity, sold, description) VALUES (?, ?, ?, ?, ?, ?)');
    foreach ($tickets as $t) {
      if (!is_array($t)) continue;
      $name = trim((string)($t['name'] ?? ''));
      $price = (float)($t['price'] ?? 0);
      $quantity = (int)($t['quantity'] ?? 0);
      $desc = isset($t['description']) ? (string)$t['description'] : null;
      if ($name === '' || $quantity < 1) {
        throw new Exception('invalid_ticket');
      }
      $ticketIns->execute([$eventId, $name, (int)round($price * 100), $quantity, 0, $desc]);
    }

    write_log($pdo, $uid, 'organizer', 'event.created', 'event', (string)$eventId, ['title' => $title]);

    $customDomain = '';
    if (is_array($customization) && !empty($customization['customDomain'])) {
      $customDomain = (string)$customization['customDomain'];
    }
    if ($customDomain !== '') {
      sync_event_custom_domain($pdo, $eventId, $customDomain);
      if (vercel_domain_credentials() !== null) {
        vercel_add_project_domain(normalize_event_hostname($customDomain));
      }
    }

    $pdo->commit();
  } catch (Exception $e) {
    $pdo->rollBack();
    json_response(400, ['error' => 'event_create_failed']);
  }

  json_response(201, ['eventId' => (string)$eventId, 'slug' => $slug]);
}

if (preg_match('#^/events/(\\d+)/duplicate$#', $path, $m) && $method === 'POST') {
  $uid = require_organizer_user_id();
  $eventId = (int)$m[1];

  $pdo = db();
  $stmt = $pdo->prepare('SELECT * FROM events WHERE id = ? LIMIT 1');
  $stmt->execute([$eventId]);
  $row = $stmt->fetch();
  if (!$row) json_response(404, ['error' => 'event_not_found']);
  deny_unless_event_row_access($pdo, $row, $uid, 'editor');

  $ticketsStmt = $pdo->prepare('SELECT name, price_cents, quantity, description FROM tickets WHERE event_id = ? ORDER BY id ASC');
  $ticketsStmt->execute([$eventId]);
  $sourceTickets = $ticketsStmt->fetchAll();

  $baseSlug = slugify($row['slug'] . '-copy');
  $newSlug = unique_slug($pdo, $baseSlug);
  $newTitle = $row['title'] . ' (Copy)';

  $customizationCopy = json_decode((string)$row['customization_json'], true);
  if (!is_array($customizationCopy)) $customizationCopy = [];
  unset($customizationCopy['customDomain'], $customizationCopy['dnsConfigured']);

  $pdo->beginTransaction();
  try {
    ensure_events_custom_domain_column($pdo);
    $ins = $pdo->prepare('INSERT INTO events (organizer_user_id, slug, title, description, event_date, location, banner_url, template_id, customization_json, status, event_status, custom_domain) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $ins->execute([
      $uid,
      $newSlug,
      $newTitle,
      $row['description'],
      $row['event_date'],
      $row['location'],
      $row['banner_url'],
      $row['template_id'],
      json_encode($customizationCopy, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
      'draft',
      'pending',
      null,
    ]);
    $newEventId = (int)$pdo->lastInsertId();

    $insTicket = $pdo->prepare('INSERT INTO tickets (event_id, name, price_cents, quantity, sold, description) VALUES (?, ?, ?, ?, 0, ?)');
    foreach ($sourceTickets as $t) {
      $insTicket->execute([$newEventId, $t['name'], (int)$t['price_cents'], (int)$t['quantity'], $t['description']]);
    }
    $pdo->commit();
  } catch (Exception $e) {
    $pdo->rollBack();
    json_response(400, ['error' => 'event_duplicate_failed']);
  }

  json_response(201, ['eventId' => (string)$newEventId, 'slug' => $newSlug]);
}

// Domain setup metadata (public)
if ($path === '/domain/config' && $method === 'GET') {
  $creds = vercel_domain_credentials();
  json_response(200, [
    'cnameTarget' => domain_cname_target(),
    'apexIp' => domain_apex_ip(),
    'platformHosts' => domain_platform_hosts(),
    'vercelAutoProvision' => $creds !== null,
    'docsUrl' => 'https://vercel.com/docs/projects/domains/add-a-domain',
  ]);
}

// Public runtime config for the SPA (keys safe to expose in browser)
if ($path === '/public/config' && $method === 'GET') {
  $mapsKey = trim((string)(getenv('GOOGLE_MAPS_API_KEY') ?: getenv('VITE_GOOGLE_MAPS_API_KEY') ?: ''));
  json_response(200, [
    'googleMapsApiKey' => $mapsKey,
    'googleMapsConfigured' => $mapsKey !== '',
    'appBaseUrl' => canonical_public_app_origin(app_base_url()),
  ]);
}

// Resolve custom hostname → event slug (edge middleware + diagnostics)
if (preg_match('#^/events/by-host/(.+)$#', $path, $m) && $method === 'GET') {
  $host = normalize_event_hostname(urldecode($m[1]));
  if ($host === '' || is_reserved_platform_host($host)) {
    json_response(404, ['error' => 'host_not_mapped']);
  }
  $slug = lookup_event_slug_by_host(db(), $host);
  if ($slug === null) json_response(404, ['error' => 'host_not_mapped']);
  json_response(200, ['host' => $host, 'slug' => $slug, 'path' => '/e/' . $slug]);
}

// Public published events list
if ($path === '/public/events' && $method === 'GET') {
  $limit = min(24, max(1, (int)($_GET['limit'] ?? 12)));
  $pdo = db();
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  $sql = "SELECT * FROM events WHERE status = 'published' AND COALESCE(event_status, 'approved') = 'approved' ORDER BY created_at DESC LIMIT " . (int)$limit;
  if ($driver === 'mysql') {
    $sql = "SELECT * FROM events WHERE status = 'published' AND event_status = 'approved' ORDER BY created_at DESC LIMIT " . (int)$limit;
  }
  $stmt = $pdo->query($sql);
  $events = [];
  while ($row = $stmt->fetch()) {
    $events[] = map_public_event_row($row, $pdo);
  }
  json_response(200, ['events' => $events]);
}

// Public event details (organizer/admin can view drafts)
if (preg_match('#^/events/(\\d+)$#', $path, $m) && $method === 'GET') {
  $eventId = (int)$m[1];
  $pdo = db();
  $row = load_event_row_or_404($pdo, $eventId);
  if (!can_view_event_row($row, current_user_id())) json_response(404, ['error' => 'event_not_found']);
  json_response(200, ['event' => map_public_event_row($row, $pdo)]);
}

// Public by slug
if (preg_match('#^/events/slug/([a-z0-9-]+)$#', $path, $m) && $method === 'GET') {
  $slug = $m[1];
  $stmt = db()->prepare('SELECT * FROM events WHERE slug = ? LIMIT 1');
  $stmt->execute([$slug]);
  $row = $stmt->fetch();
  if (!$row || !is_event_publicly_visible($row)) json_response(404, ['error' => 'event_not_found']);
  json_response(200, ['event' => map_public_event_row($row, db())]);
}

// Organizer: update slug
if (preg_match('#^/events/(\\d+)/slug$#', $path, $m) && $method === 'POST') {
  $uid = require_organizer_user_id();
  $eventId = (int)$m[1];
  $body = read_json_body();
  $newSlugRaw = trim((string)($body['slug'] ?? ''));
  if ($newSlugRaw === '') json_response(400, ['error' => 'invalid_slug']);
  $newSlug = slugify($newSlugRaw);

  $pdo = db();
  $stmt = $pdo->prepare('SELECT id, organizer_user_id FROM events WHERE id = ? LIMIT 1');
  $stmt->execute([$eventId]);
  $row = $stmt->fetch();
  if (!$row) json_response(404, ['error' => 'event_not_found']);
  deny_unless_event_row_access($pdo, $row, $uid, 'editor');

  $stmt2 = $pdo->prepare('SELECT id FROM events WHERE slug = ? AND id <> ? LIMIT 1');
  $stmt2->execute([$newSlug, $eventId]);
  if ($stmt2->fetch()) json_response(409, ['error' => 'slug_taken']);

  $upd = $pdo->prepare('UPDATE events SET slug = ? WHERE id = ?');
  $upd->execute([$newSlug, $eventId]);
  json_response(200, ['slug' => $newSlug]);
}

// Organizer: custom domain management
if (preg_match('#^/events/(\\d+)/domain$#', $path, $m) && $method === 'GET') {
  $uid = require_organizer_user_id();
  $eventId = (int)$m[1];
  $pdo = db();
  $row = load_event_row_or_404($pdo, $eventId);
  deny_unless_event_row_access($pdo, $row, $uid, 'editor');

  $domain = (string)($row['custom_domain'] ?? '');
  $dns = $domain !== '' ? domain_dns_instructions($domain) : null;
  $vercel = $domain !== '' ? vercel_get_project_domain($domain) : ['ok' => false, 'skipped' => true];

  json_response(200, [
    'customDomain' => $domain !== '' ? $domain : null,
    'publicUrl' => $domain !== '' ? ('https://' . $domain) : null,
    'defaultUrl' => '/e/' . $row['slug'],
    'dns' => $dns,
    'vercel' => $vercel,
    'cnameTarget' => domain_cname_target(),
    'apexIp' => domain_apex_ip(),
  ]);
}

if (preg_match('#^/events/(\\d+)/domain$#', $path, $m) && $method === 'POST') {
  $uid = require_organizer_user_id();
  $eventId = (int)$m[1];
  $body = read_json_body();
  $domainRaw = trim((string)($body['domain'] ?? ''));
  if ($domainRaw === '') json_response(400, ['error' => 'invalid_domain']);

  $pdo = db();
  $row = load_event_row_or_404($pdo, $eventId);
  deny_unless_event_row_access($pdo, $row, $uid, 'editor');

  $domain = normalize_event_hostname($domainRaw);
  if (!is_valid_event_hostname($domain)) json_response(400, ['error' => 'invalid_domain', 'message' => 'Enter a valid domain like events.yourbrand.com']);
  if (is_reserved_platform_host($domain)) json_response(400, ['error' => 'domain_reserved']);

  sync_event_custom_domain($pdo, $eventId, $domain);
  $vercel = vercel_add_project_domain($domain);
  $dns = domain_dns_instructions($domain);

  json_response(200, [
    'ok' => true,
    'customDomain' => $domain,
    'publicUrl' => 'https://' . $domain,
    'dns' => $dns,
    'vercel' => $vercel,
  ]);
}

if (preg_match('#^/events/(\\d+)/domain$#', $path, $m) && $method === 'DELETE') {
  $uid = require_organizer_user_id();
  $eventId = (int)$m[1];
  $pdo = db();
  $row = load_event_row_or_404($pdo, $eventId);
  deny_unless_event_row_access($pdo, $row, $uid, 'editor');
  sync_event_custom_domain($pdo, $eventId, null);
  json_response(200, ['ok' => true, 'customDomain' => null]);
}

if (preg_match('#^/events/(\\d+)/domain/verify$#', $path, $m) && $method === 'POST') {
  $uid = require_organizer_user_id();
  $eventId = (int)$m[1];
  $pdo = db();
  $row = load_event_row_or_404($pdo, $eventId);
  deny_unless_event_row_access($pdo, $row, $uid, 'editor');
  $domain = (string)($row['custom_domain'] ?? '');
  if ($domain === '') json_response(400, ['error' => 'domain_not_set']);

  $vercel = vercel_get_project_domain($domain);
  $dnsOk = false;
  $records = @dns_get_record($domain, DNS_CNAME);
  $target = strtolower(domain_cname_target());
  if (is_array($records)) {
    foreach ($records as $rec) {
      $val = strtolower((string)($rec['target'] ?? ''));
      if ($val !== '' && (str_contains($val, 'vercel') || $val === $target || str_ends_with($val, '.vercel-dns.com'))) {
        $dnsOk = true;
        break;
      }
    }
  }
  if (!$dnsOk) {
    $aRecords = @dns_get_record($domain, DNS_A);
    if (is_array($aRecords)) {
      foreach ($aRecords as $rec) {
        if ((string)($rec['ip'] ?? '') === domain_apex_ip()) {
          $dnsOk = true;
          break;
        }
      }
    }
  }

  if ($vercel['verified'] ?? false) {
    $customization = json_decode((string)$row['customization_json'], true);
    if (!is_array($customization)) $customization = [];
    $customization['dnsConfigured'] = true;
    $pdo->prepare('UPDATE events SET customization_json = ? WHERE id = ?')->execute([
      json_encode($customization, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
      $eventId,
    ]);
  }

  $platformVerified = (bool)($vercel['verified'] ?? false);
  $platformSkipped = (bool)($vercel['skipped'] ?? false);
  $configured = $platformVerified || ($platformSkipped && $dnsOk);

  json_response(200, [
    'dnsDetected' => $dnsOk,
    'vercel' => $vercel,
    'configured' => $configured,
    'platformVerified' => $platformVerified,
  ]);
}

// Organizer: publish/unpublish/cancel own event
if (preg_match('#^/events/(\\d+)/status$#', $path, $m) && $method === 'POST') {
  $uid = require_organizer_user_id();
  $eventId = (int)$m[1];
  $body = read_json_body();
  $status = (string)($body['status'] ?? '');
  if (!in_array($status, ['draft', 'published', 'cancelled'], true)) {
    json_response(400, ['error' => 'invalid_status']);
  }

  $pdo = db();
  $stmt = $pdo->prepare('SELECT organizer_user_id FROM events WHERE id = ? LIMIT 1');
  $stmt->execute([$eventId]);
  $row = $stmt->fetch();
  if (!$row) json_response(404, ['error' => 'event_not_found']);
  deny_unless_event_row_access($pdo, $row, $uid, 'editor');

  $upd = $pdo->prepare('UPDATE events SET status = ? WHERE id = ?');
  $upd->execute([$status, $eventId]);
  write_log($pdo, $uid, 'organizer', 'event.status_changed', 'event', (string)$eventId, ['status' => $status]);
  json_response(200, ['ok' => true, 'status' => $status]);
}

if (preg_match('#^/events/(\\d+)/branding$#', $path, $m) && $method === 'POST') {
  $uid = require_organizer_user_id();
  $eventId = (int)$m[1];
  $body = read_json_body();
  $pdo = db();
  $row = load_event_row_or_404($pdo, $eventId);
  deny_unless_event_row_access($pdo, $row, $uid, 'editor');

  $customization = json_decode((string)$row['customization_json'], true);
  if (!is_array($customization)) $customization = [];

  $themeId = trim((string)($body['themeId'] ?? ''));
  if ($themeId !== '' && is_event_theme_id($themeId)) {
    $theme = event_theme_catalog()[$themeId];
    $customization['themeId'] = $themeId;
    $customization['primaryColor'] = $theme['primary'];
    $customization['secondaryColor'] = $theme['secondary'];
  }

  // Explicit landing design overrides (applied after theme defaults so custom
  // colour/style/font/display chosen by the organizer always win).
  if (array_key_exists('primaryColor', $body)) {
    $primaryColor = strtolower(trim((string)$body['primaryColor']));
    if (preg_match('/^#([0-9a-f]{6})$/', $primaryColor)) {
      $customization['primaryColor'] = $primaryColor;
    }
  }
  if (array_key_exists('secondaryColor', $body)) {
    $secondaryColor = strtolower(trim((string)$body['secondaryColor']));
    if (preg_match('/^#([0-9a-f]{6})$/', $secondaryColor)) {
      $customization['secondaryColor'] = $secondaryColor;
    }
  }
  if (array_key_exists('fontFamily', $body)) {
    $fontFamily = trim((string)$body['fontFamily']);
    $allowedFonts = ['fraunces', 'playfair', 'sora', 'space-grotesk', 'dm-serif', 'poppins', 'manrope'];
    if (in_array($fontFamily, $allowedFonts, true)) {
      $customization['fontFamily'] = $fontFamily;
    }
  }
  if (array_key_exists('displayMode', $body)) {
    $displayMode = trim((string)$body['displayMode']);
    if (in_array($displayMode, ['auto', 'light', 'dark'], true)) {
      $customization['displayMode'] = $displayMode;
    }
  }
  if (array_key_exists('landingStyle', $body)) {
    $landingStyle = trim((string)$body['landingStyle']);
    if (in_array($landingStyle, ['glass', 'minimal', 'bold'], true)) {
      $customization['landingStyle'] = $landingStyle;
    }
  }
  if (array_key_exists('eventCategory', $body)) {
    $eventCategory = trim((string)$body['eventCategory']);
    $allowedCategories = ['default', 'music', 'sports', 'business', 'arts', 'wellness', 'nightlife', 'tech'];
    if (in_array($eventCategory, $allowedCategories, true)) {
      $customization['eventCategory'] = $eventCategory;
    }
  }
  if (array_key_exists('scheduleTba', $body)) {
    $customization['scheduleTba'] = (bool)$body['scheduleTba'];
  }
  if (array_key_exists('checkoutFields', $body)) {
    $customization['checkoutFields'] = normalize_checkout_fields($body['checkoutFields']);
  }
  if (array_key_exists('arenaGalleryImages', $body)) {
    $customization['arenaGalleryImages'] = normalize_arena_gallery_images($body['arenaGalleryImages']);
  }

  if (array_key_exists('bannerUrl', $body)) {
    $nextBanner = trim((string)$body['bannerUrl']);
    if ($nextBanner !== '') $row['banner_url'] = $nextBanner;
  }

  if (array_key_exists('title', $body)) {
    $title = trim((string)$body['title']);
    if (strlen($title) >= 3) $row['title'] = $title;
    else json_response(400, ['error' => 'invalid_title']);
  }
  if (array_key_exists('description', $body)) {
    $row['description'] = trim((string)$body['description']);
  }
  if (array_key_exists('location', $body)) {
    $location = trim((string)$body['location']);
    if ($location === '') json_response(400, ['error' => 'invalid_location']);
    $row['location'] = $location;
  }
  if (array_key_exists('date', $body)) {
    $date = trim((string)$body['date']);
    if ($date === '') json_response(400, ['error' => 'invalid_date']);
    $row['event_date'] = date('Y-m-d H:i:s', strtotime($date));
  }

  $templateId = trim((string)($body['templateId'] ?? ''));
  $allowedTemplates = ['template-2', 'template-5', 'template-6', 'template-canvas'];
  $legacyTemplates = ['template-1', 'template-3', 'template-4'];
  if ($templateId !== '' && in_array($templateId, $allowedTemplates, true)) {
    $row['template_id'] = $templateId;
  } elseif ($templateId !== '' && in_array($templateId, $legacyTemplates, true)) {
    $row['template_id'] = 'template-2';
  } elseif ($themeId !== '' && is_event_theme_id($themeId)) {
    $row['template_id'] = event_theme_catalog()[$themeId]['templateId'];
  }

  $customization['heroText'] = $row['title'];
  if (array_key_exists('heroSubtext', $body)) {
    // Organizer-provided short description wins (empty string clears it).
    $customization['heroSubtext'] = mb_substr(trim((string)$body['heroSubtext']), 0, 160);
  } elseif (empty($customization['heroSubtext']) && !empty($row['description'])) {
    // Backfill only when never set, so legacy events still show a subtitle.
    $customization['heroSubtext'] = mb_substr((string)$row['description'], 0, 100);
  }

  $upd = $pdo->prepare(
    'UPDATE events SET title = ?, description = ?, event_date = ?, location = ?, banner_url = ?, template_id = ?, customization_json = ? WHERE id = ?'
  );
  $upd->execute([
    $row['title'],
    $row['description'],
    $row['event_date'],
    $row['location'],
    $row['banner_url'],
    $row['template_id'],
    json_encode($customization, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
    $eventId,
  ]);

  $fresh = load_event_row_or_404($pdo, $eventId);
  json_response(200, ['event' => map_public_event_row($fresh, $pdo)]);
}

if (preg_match('#^/events/(\\d+)/ticket-design$#', $path, $m) && $method === 'POST') {
  $uid = require_organizer_user_id();
  $eventId = (int)$m[1];
  $body = read_json_body();

  $templateId = trim((string)($body['templateId'] ?? 'classic'));
  $primary = trim((string)($body['primaryColor'] ?? '#4f46e5'));
  $accent = trim((string)($body['accentColor'] ?? '#10b981'));
  $badgeText = trim((string)($body['badgeText'] ?? 'VIP ACCESS'));
  $footerNote = trim((string)($body['footerNote'] ?? 'Please bring this ticket and a valid ID.'));

  $allowed = ['classic', 'midnight', 'sunset'];
  if (!in_array($templateId, $allowed, true)) json_response(400, ['error' => 'invalid_template']);
  if (!preg_match('/^#[0-9a-fA-F]{6}$/', $primary)) json_response(400, ['error' => 'invalid_primary_color']);
  if (!preg_match('/^#[0-9a-fA-F]{6}$/', $accent)) json_response(400, ['error' => 'invalid_accent_color']);
  if (mb_strlen($badgeText) > 40) json_response(400, ['error' => 'invalid_badge_text']);
  if (mb_strlen($footerNote) > 160) json_response(400, ['error' => 'invalid_footer_note']);

  $pdo = db();
  $stmt = $pdo->prepare('SELECT organizer_user_id, customization_json FROM events WHERE id = ? LIMIT 1');
  $stmt->execute([$eventId]);
  $row = $stmt->fetch();
  if (!$row) json_response(404, ['error' => 'event_not_found']);
  deny_unless_event_row_access($pdo, $row, $uid, 'editor');

  $customization = json_decode((string)$row['customization_json'], true);
  if (!is_array($customization)) $customization = [];
  $customization['ticketPdfTemplateId'] = $templateId;
  $customization['ticketPdfPrimaryColor'] = strtolower($primary);
  $customization['ticketPdfAccentColor'] = strtolower($accent);
  $customization['ticketPdfBadgeText'] = $badgeText !== '' ? $badgeText : 'VIP ACCESS';
  $customization['ticketPdfFooterNote'] = $footerNote !== '' ? $footerNote : 'Please bring this ticket and a valid ID.';

  $upd = $pdo->prepare('UPDATE events SET customization_json = ? WHERE id = ?');
  $upd->execute([json_encode($customization, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), $eventId]);

  json_response(200, ['customization' => $customization]);
}

if (preg_match('#^/events/(\\d+)/tickets$#', $path, $m) && $method === 'GET') {
  $eventId = (int)$m[1];
  $pdo = db();
  $row = load_event_row_or_404($pdo, $eventId);
  if (!can_view_event_row($row, current_user_id())) json_response(404, ['error' => 'event_not_found']);
  $stmt = $pdo->prepare('SELECT * FROM tickets WHERE event_id = ? ORDER BY id ASC');
  $stmt->execute([$eventId]);
  $tickets = [];
  while ($row = $stmt->fetch()) {
    $tickets[] = [
      'id' => (string)$row['id'],
      'eventId' => (string)$row['event_id'],
      'name' => $row['name'],
      'price' => ((int)$row['price_cents']) / 100,
      'quantity' => (int)$row['quantity'],
      'sold' => (int)$row['sold'],
      'description' => $row['description'],
    ];
  }
  json_response(200, ['tickets' => $tickets]);
}

if (preg_match('#^/events/(\\d+)/tickets$#', $path, $m) && $method === 'POST') {
  $uid = require_organizer_user_id();
  $eventId = (int)$m[1];
  $body = read_json_body();

  $name = trim((string)($body['name'] ?? ''));
  $price = (float)($body['price'] ?? 0);
  $quantity = (int)($body['quantity'] ?? 0);
  $description = isset($body['description']) ? trim((string)$body['description']) : null;

  if ($name === '') json_response(400, ['error' => 'invalid_ticket_name']);
  if ($price < 0) json_response(400, ['error' => 'invalid_ticket_price']);
  if ($quantity < 1) json_response(400, ['error' => 'invalid_ticket_quantity']);

  $pdo = db();
  $stmt = $pdo->prepare('SELECT organizer_user_id FROM events WHERE id = ? LIMIT 1');
  $stmt->execute([$eventId]);
  $row = $stmt->fetch();
  if (!$row) json_response(404, ['error' => 'event_not_found']);
  deny_unless_event_row_access($pdo, $row, $uid, 'editor');
  assert_organizer_can_sell_paid_tickets($pdo, (int)$row['organizer_user_id'], $price);

  $ins = $pdo->prepare('INSERT INTO tickets (event_id, name, price_cents, quantity, sold, description) VALUES (?, ?, ?, ?, 0, ?)');
  $ins->execute([$eventId, $name, (int)round($price * 100), $quantity, $description !== '' ? $description : null]);
  $ticketId = (int)$pdo->lastInsertId();

  json_response(201, [
    'ticket' => [
      'id' => (string)$ticketId,
      'eventId' => (string)$eventId,
      'name' => $name,
      'price' => $price,
      'quantity' => $quantity,
      'sold' => 0,
      'description' => $description,
    ],
  ]);
}

if (preg_match('#^/events/(\\d+)/tickets/(\\d+)$#', $path, $m) && $method === 'POST') {
  $uid = require_organizer_user_id();
  $eventId = (int)$m[1];
  $ticketId = (int)$m[2];
  $body = read_json_body();

  $name = trim((string)($body['name'] ?? ''));
  $price = (float)($body['price'] ?? 0);
  $quantity = (int)($body['quantity'] ?? 0);
  $description = isset($body['description']) ? trim((string)$body['description']) : null;

  if ($name === '') json_response(400, ['error' => 'invalid_ticket_name']);
  if ($price < 0) json_response(400, ['error' => 'invalid_ticket_price']);
  if ($quantity < 1) json_response(400, ['error' => 'invalid_ticket_quantity']);

  $pdo = db();
  $owner = $pdo->prepare('SELECT organizer_user_id FROM events WHERE id = ? LIMIT 1');
  $owner->execute([$eventId]);
  $row = $owner->fetch();
  if (!$row) json_response(404, ['error' => 'event_not_found']);
  deny_unless_event_row_access($pdo, $row, $uid, 'editor');

  $existing = $pdo->prepare('SELECT id, sold FROM tickets WHERE id = ? AND event_id = ? LIMIT 1');
  $existing->execute([$ticketId, $eventId]);
  $ticket = $existing->fetch();
  if (!$ticket) json_response(404, ['error' => 'ticket_not_found']);
  if ($quantity < (int)$ticket['sold']) json_response(400, ['error' => 'quantity_below_sold']);
  assert_organizer_can_sell_paid_tickets($pdo, (int)$row['organizer_user_id'], $price);

  $upd = $pdo->prepare('UPDATE tickets SET name = ?, price_cents = ?, quantity = ?, description = ? WHERE id = ? AND event_id = ?');
  $upd->execute([$name, (int)round($price * 100), $quantity, $description !== '' ? $description : null, $ticketId, $eventId]);

  json_response(200, [
    'ticket' => [
      'id' => (string)$ticketId,
      'eventId' => (string)$eventId,
      'name' => $name,
      'price' => $price,
      'quantity' => $quantity,
      'sold' => (int)$ticket['sold'],
      'description' => $description,
    ],
  ]);
}

if (preg_match('#^/events/(\\d+)/tickets/(\\d+)/delete$#', $path, $m) && $method === 'POST') {
  $uid = require_organizer_user_id();
  $eventId = (int)$m[1];
  $ticketId = (int)$m[2];
  $pdo = db();

  $owner = $pdo->prepare('SELECT organizer_user_id FROM events WHERE id = ? LIMIT 1');
  $owner->execute([$eventId]);
  $row = $owner->fetch();
  if (!$row) json_response(404, ['error' => 'event_not_found']);
  deny_unless_event_row_access($pdo, $row, $uid, 'editor');

  $ticket = $pdo->prepare('SELECT sold FROM tickets WHERE id = ? AND event_id = ? LIMIT 1');
  $ticket->execute([$ticketId, $eventId]);
  $r = $ticket->fetch();
  if (!$r) json_response(404, ['error' => 'ticket_not_found']);
  if ((int)$r['sold'] > 0) json_response(400, ['error' => 'ticket_has_sales']);

  $del = $pdo->prepare('DELETE FROM tickets WHERE id = ? AND event_id = ?');
  $del->execute([$ticketId, $eventId]);
  json_response(200, ['ok' => true]);
}

// ---- Orders ----
if ($path === '/orders' && $method === 'POST') {
  $body = read_json_body();
  $eventId = (int)($body['eventId'] ?? 0);
  $buyerName = trim((string)($body['buyerName'] ?? ''));
  $buyerPhone = trim((string)($body['buyerPhone'] ?? ''));
  $buyerEmail = strtolower(trim((string)($body['buyerEmail'] ?? '')));
  $items = $body['tickets'] ?? [];
  $attendees = $body['attendees'] ?? [];

  if ($eventId <= 0) json_response(400, ['error' => 'invalid_event']);
  if ($buyerEmail === '' || !filter_var($buyerEmail, FILTER_VALIDATE_EMAIL)) json_response(400, ['error' => 'invalid_buyer_email']);
  if (!is_array($items) || count($items) < 1) json_response(400, ['error' => 'invalid_order_items']);

  $pdo = db();
  $ev = require_publishable_event($pdo, $eventId);
  $normalized = normalize_order_items_from_db($pdo, $eventId, $items);
  $totalCents = (int)$normalized['totalCents'];
  $normalizedItems = $normalized['items'];
  if ($totalCents > 0) {
    json_response(400, ['error' => 'paid_orders_use_payhere', 'message' => 'Use PayHere checkout for paid tickets.']);
  }

  $expectedAttendees = expected_attendee_count_from_items($normalizedItems);
  if ($expectedAttendees < 1) json_response(400, ['error' => 'invalid_order_items']);
  if (!is_array($attendees) || count($attendees) < 1) json_response(400, ['error' => 'invalid_attendees']);
  $checkoutFields = checkout_fields_from_event_row($ev);
  validate_attendees_for_order($normalizedItems, $attendees, $checkoutFields);

  $buyerId = current_user_id();
  $pdo->beginTransaction();
  try {
    $ins = $pdo->prepare('INSERT INTO orders (event_id, buyer_user_id, buyer_name, buyer_phone, buyer_email, tickets_json, total_amount_cents, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $ins->execute([
      $eventId,
      $buyerId,
      $buyerName !== '' ? $buyerName : null,
      $buyerPhone !== '' ? $buyerPhone : null,
      $buyerEmail,
      json_encode($normalizedItems, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
      $totalCents,
      'paid',
    ]);
    $orderId = (int)$pdo->lastInsertId();
    upsert_transaction($pdo, $eventId, $buyerId, $orderId, $totalCents, 'paid', null);
    increment_ticket_sold_counts($pdo, $normalizedItems);

    $createdCount = insert_attendees_for_order(
      $pdo,
      $orderId,
      $eventId,
      $attendees,
      $buyerEmail,
      $buyerPhone,
      $buyerName !== '' ? $buyerName : 'Attendee',
      $checkoutFields
    );
    if ($createdCount !== $expectedAttendees) {
      throw new Exception('invalid_attendee');
    }
    $pdo->commit();

    send_order_confirmation_email($pdo, $orderId);

    json_response(201, [
      'orderId' => (string)$orderId,
      'accessToken' => issue_order_access_token($orderId),
    ]);
  } catch (Exception $e) {
    $pdo->rollBack();
    json_response(400, ['error' => 'order_create_failed']);
  }
}

if (preg_match('#^/orders/(\\d+)$#', $path, $m) && $method === 'GET') {
  $orderId = (int)$m[1];
  $uid = current_user_id();
  $accessToken = trim((string)($_GET['token'] ?? ''));
  $pdo = db();
  $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ? LIMIT 1');
  $stmt->execute([$orderId]);
  $row = $stmt->fetch();
  if (!$row) json_response(404, ['error' => 'order_not_found']);

  $eventOwnerStmt = $pdo->prepare('SELECT organizer_user_id FROM events WHERE id = ? LIMIT 1');
  $eventOwnerStmt->execute([(int)$row['event_id']]);
  $eventOwner = $eventOwnerStmt->fetch();
  $buyerEmailNorm = strtolower(trim((string)($row['buyer_email'] ?? '')));
  $isBuyer = false;
  if ($uid !== null) {
    if ((int)($row['buyer_user_id'] ?? 0) === $uid) {
      $isBuyer = true;
    } else {
      $buyerUser = load_user_profile($uid);
      $userEmailNorm = strtolower(trim((string)($buyerUser['email'] ?? '')));
      if ($buyerEmailNorm !== '' && $userEmailNorm !== '' && $buyerEmailNorm === $userEmailNorm) {
        $isBuyer = true;
      }
    }
  }
  $isOrganizerOwner = ($uid !== null) && ((int)($eventOwner['organizer_user_id'] ?? 0) === $uid);
  $tokenPayload = $accessToken !== '' ? order_access_token_payload($accessToken, $orderId) : null;
  $hasAccessToken = $tokenPayload !== null;
  if (!$isBuyer && !$isOrganizerOwner && !$hasAccessToken) json_response(403, ['error' => 'forbidden']);

  if ($hasAccessToken && (string)$row['status'] === 'pending') {
    payhere_sync_order_from_transactions($pdo, $orderId);
    $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ? LIMIT 1');
    $stmt->execute([$orderId]);
    $row = $stmt->fetch();
    if (!$row) json_response(404, ['error' => 'order_not_found']);
  }

  // Scoped ticket links always limit visibility — even if organizer/buyer is logged in.
  $attendeeFilterIds = null;
  $passParam = (int)($_GET['pass'] ?? 0);
  if ($hasAccessToken) {
    $scopedIds = order_access_token_attendee_ids($tokenPayload);
    if ($scopedIds !== null) {
      $attendeeFilterIds = $scopedIds;
      if ($passParam > 0) {
        if (!in_array($passParam, $attendeeFilterIds, true)) {
          json_response(403, ['error' => 'forbidden', 'message' => 'This ticket link is not valid for that pass.']);
        }
        $attendeeFilterIds = [$passParam];
      }
    } elseif ($passParam > 0) {
      // Purchaser token + ?pass= — share a single QR without re-issuing a scoped token.
      $attendeeFilterIds = [$passParam];
    }
  }

  $items = json_decode($row['tickets_json'], true);
  if (!is_array($items)) $items = [];
  $stmt2 = $pdo->prepare(
    'SELECT a.id, a.ticket_id, a.full_name, a.email, a.phone, a.qr_token, a.checked_in_at, a.custom_fields_json, t.name AS ticket_name
     FROM attendees a
     LEFT JOIN tickets t ON t.id = a.ticket_id
     WHERE a.order_id = ?
     ORDER BY a.id ASC'
  );
  $stmt2->execute([$orderId]);
  $att = [];
  while ($a = $stmt2->fetch()) {
    $attendeeRowId = (int)$a['id'];
    if ($attendeeFilterIds !== null && !in_array($attendeeRowId, $attendeeFilterIds, true)) {
      continue;
    }
    $rowShape = [
      'id' => (string)$a['id'],
      'ticketId' => (string)$a['ticket_id'],
      'ticketName' => $a['ticket_name'] ?? null,
      'fullName' => $a['full_name'],
      'email' => $a['email'],
      'phone' => $a['phone'],
      'qrToken' => $a['qr_token'],
      'checkedInAt' => $a['checked_in_at'] ? gmdate('c', strtotime($a['checked_in_at'])) : null,
    ];
    $custom = decode_attendee_custom_fields($a['custom_fields_json'] ?? null);
    if ($custom !== null) $rowShape['customFields'] = $custom;
    $att[] = $rowShape;
  }

  if ($attendeeFilterIds !== null && count($att) === 0 && (string)$row['status'] === 'paid') {
    payhere_sync_order_from_transactions($pdo, $orderId);
    $stmt2->execute([$orderId]);
    $att = [];
    while ($a = $stmt2->fetch()) {
      $attendeeRowId = (int)$a['id'];
      if ($attendeeFilterIds !== null && !in_array($attendeeRowId, $attendeeFilterIds, true)) {
        continue;
      }
      $retryShape = [
        'id' => (string)$a['id'],
        'ticketId' => (string)$a['ticket_id'],
        'ticketName' => $a['ticket_name'] ?? null,
        'fullName' => $a['full_name'],
        'email' => $a['email'],
        'phone' => $a['phone'],
        'qrToken' => $a['qr_token'],
        'checkedInAt' => $a['checked_in_at'] ? gmdate('c', strtotime($a['checked_in_at'])) : null,
      ];
      $customRetry = decode_attendee_custom_fields($a['custom_fields_json'] ?? null);
      if ($customRetry !== null) $retryShape['customFields'] = $customRetry;
      $att[] = $retryShape;
    }
  }

  if ($attendeeFilterIds !== null && count($att) === 0) {
    json_response(403, ['error' => 'forbidden', 'message' => 'Ticket pass not found for this order.']);
  }

  $viewScope = $attendeeFilterIds !== null ? 'attendee' : 'order';

  $eventPayload = null;
  if ($hasAccessToken || $isBuyer || $isOrganizerOwner) {
    $evStmt = $pdo->prepare('SELECT * FROM events WHERE id = ? LIMIT 1');
    $evStmt->execute([(int)$row['event_id']]);
    $evRow = $evStmt->fetch();
    if ($evRow) {
      $eventPayload = map_public_event_row($evRow, $pdo);
    }
  }

  json_response(200, [
    'order' => [
      'id' => (string)$row['id'],
      'eventId' => (string)$row['event_id'],
      'buyerId' => $row['buyer_user_id'] !== null ? (string)$row['buyer_user_id'] : null,
      'buyerName' => $row['buyer_name'] ?? null,
      'buyerPhone' => $row['buyer_phone'] ?? null,
      'buyerEmail' => $row['buyer_email'],
      'tickets' => $viewScope === 'attendee' ? [] : $items,
      'totalAmount' => ((int)$row['total_amount_cents']) / 100,
      'status' => $row['status'],
      'createdAt' => gmdate('c', strtotime($row['created_at'])),
      'attendees' => $att,
      'viewScope' => $viewScope,
    ],
    'event' => $eventPayload,
  ]);
}

if ($path === '/me/orders' && $method === 'GET') {
  $uid = require_user_id();
  $user = load_user_profile($uid);
  $pdo = db();

  $stmt = $pdo->prepare(
    'SELECT o.*
     FROM orders o
     WHERE o.buyer_user_id = ?
        OR o.buyer_email = ?
     ORDER BY o.created_at DESC'
  );
  $stmt->execute([$uid, $user['email']]);

  $orders = [];
  while ($row = $stmt->fetch()) {
    $items = json_decode($row['tickets_json'], true);
    if (!is_array($items)) $items = [];

    $eventStmt = $pdo->prepare(
      'SELECT e.id, e.slug, e.title, e.event_date, e.location, e.banner_url, u.email AS organizer_email, u.display_name AS organizer_name
       FROM events e
       JOIN users u ON u.id = e.organizer_user_id
       WHERE e.id = ?
       LIMIT 1'
    );
    $eventStmt->execute([(int)$row['event_id']]);
    $event = $eventStmt->fetch();

    $attStmt = $pdo->prepare('SELECT id, ticket_id, full_name, email, phone, qr_token, checked_in_at FROM attendees WHERE order_id = ? ORDER BY id ASC');
    $attStmt->execute([(int)$row['id']]);
    $attendees = [];
    while ($a = $attStmt->fetch()) {
      $attendees[] = [
        'id' => (string)$a['id'],
        'ticketId' => (string)$a['ticket_id'],
        'fullName' => $a['full_name'],
        'email' => $a['email'],
        'phone' => $a['phone'],
        'qrToken' => $a['qr_token'],
        'checkedInAt' => $a['checked_in_at'] ? gmdate('c', strtotime($a['checked_in_at'])) : null,
      ];
    }

    $orders[] = [
      'id' => (string)$row['id'],
      'eventId' => (string)$row['event_id'],
      'buyerId' => $row['buyer_user_id'] !== null ? (string)$row['buyer_user_id'] : null,
      'buyerName' => $row['buyer_name'] ?? null,
      'buyerPhone' => $row['buyer_phone'] ?? null,
      'buyerEmail' => $row['buyer_email'],
      'tickets' => $items,
      'totalAmount' => ((int)$row['total_amount_cents']) / 100,
      'status' => $row['status'],
      'createdAt' => gmdate('c', strtotime($row['created_at'])),
      'attendees' => $attendees,
      'event' => $event ? [
        'id' => (string)$event['id'],
        'slug' => $event['slug'],
        'title' => $event['title'],
        'date' => gmdate('c', strtotime($event['event_date'])),
        'location' => $event['location'],
        'bannerUrl' => $event['banner_url'],
        'organizerEmail' => $event['organizer_email'],
        'organizerName' => $event['organizer_name'],
      ] : null,
    ];
  }

  json_response(200, ['orders' => $orders]);
}

// ---- Speakers ----
if (preg_match('#^/events/(\\d+)/speakers$#', $path, $m) && $method === 'GET') {
  $uid = require_organizer_user_id();
  $eventId = (int)$m[1];

  $pdo = db();
  $stmt = $pdo->prepare('SELECT organizer_user_id FROM events WHERE id = ? LIMIT 1');
  $stmt->execute([$eventId]);
  $row = $stmt->fetch();
  if (!$row) json_response(404, ['error' => 'event_not_found']);
  deny_unless_event_row_access($pdo, $row, $uid, 'editor');

  $stmt2 = db()->prepare('SELECT * FROM speakers WHERE event_id = ? ORDER BY id DESC');
  $stmt2->execute([$eventId]);
  $speakers = [];
  while ($s = $stmt2->fetch()) {
    $speakers[] = [
      'id' => (string)$s['id'],
      'eventId' => (string)$s['event_id'],
      'name' => $s['name'],
      'title' => $s['title'],
      'company' => $s['company'],
      'bio' => $s['bio'],
      'avatarUrl' => $s['avatar_url'],
      'createdAt' => gmdate('c', strtotime($s['created_at'])),
    ];
  }
  json_response(200, ['speakers' => $speakers]);
}

if (preg_match('#^/events/(\\d+)/speakers$#', $path, $m) && $method === 'POST') {
  $uid = require_organizer_user_id();
  $eventId = (int)$m[1];
  $body = read_json_body();

  $name = trim((string)($body['name'] ?? ''));
  $title = trim((string)($body['title'] ?? ''));
  $company = trim((string)($body['company'] ?? ''));
  $bio = trim((string)($body['bio'] ?? ''));
  $avatarUrl = trim((string)($body['avatarUrl'] ?? ''));
  if ($name === '') json_response(400, ['error' => 'invalid_name']);

  $pdo = db();
  $stmt = $pdo->prepare('SELECT organizer_user_id FROM events WHERE id = ? LIMIT 1');
  $stmt->execute([$eventId]);
  $row = $stmt->fetch();
  if (!$row) json_response(404, ['error' => 'event_not_found']);
  deny_unless_event_row_access($pdo, $row, $uid, 'editor');

  $ins = $pdo->prepare('INSERT INTO speakers (event_id, name, title, company, bio, avatar_url) VALUES (?, ?, ?, ?, ?, ?)');
  $ins->execute([
    $eventId,
    $name,
    $title !== '' ? $title : null,
    $company !== '' ? $company : null,
    $bio !== '' ? $bio : null,
    $avatarUrl !== '' ? $avatarUrl : null,
  ]);
  json_response(201, ['speakerId' => (string)$pdo->lastInsertId()]);
}

if (preg_match('#^/events/(\\d+)/speakers/(\\d+)$#', $path, $m) && $method === 'POST') {
  $uid = require_organizer_user_id();
  $eventId = (int)$m[1];
  $speakerId = (int)$m[2];
  $body = read_json_body();

  $pdo = db();
  $stmt = $pdo->prepare('SELECT organizer_user_id FROM events WHERE id = ? LIMIT 1');
  $stmt->execute([$eventId]);
  $row = $stmt->fetch();
  if (!$row) json_response(404, ['error' => 'event_not_found']);
  deny_unless_event_row_access($pdo, $row, $uid, 'editor');

  $stmt2 = $pdo->prepare('SELECT id FROM speakers WHERE id = ? AND event_id = ? LIMIT 1');
  $stmt2->execute([$speakerId, $eventId]);
  if (!$stmt2->fetch()) json_response(404, ['error' => 'speaker_not_found']);

  $name = trim((string)($body['name'] ?? ''));
  if ($name === '') json_response(400, ['error' => 'invalid_name']);
  $title = trim((string)($body['title'] ?? ''));
  $company = trim((string)($body['company'] ?? ''));
  $bio = trim((string)($body['bio'] ?? ''));
  $avatarUrl = trim((string)($body['avatarUrl'] ?? ''));

  $upd = $pdo->prepare('UPDATE speakers SET name = ?, title = ?, company = ?, bio = ?, avatar_url = ? WHERE id = ? AND event_id = ?');
  $upd->execute([
    $name,
    $title !== '' ? $title : null,
    $company !== '' ? $company : null,
    $bio !== '' ? $bio : null,
    $avatarUrl !== '' ? $avatarUrl : null,
    $speakerId,
    $eventId,
  ]);
  json_response(200, ['ok' => true]);
}

if (preg_match('#^/events/(\\d+)/speakers/(\\d+)/delete$#', $path, $m) && $method === 'POST') {
  $uid = require_organizer_user_id();
  $eventId = (int)$m[1];
  $speakerId = (int)$m[2];

  $pdo = db();
  $stmt = $pdo->prepare('SELECT organizer_user_id FROM events WHERE id = ? LIMIT 1');
  $stmt->execute([$eventId]);
  $row = $stmt->fetch();
  if (!$row) json_response(404, ['error' => 'event_not_found']);
  deny_unless_event_row_access($pdo, $row, $uid, 'editor');

  $del = $pdo->prepare('DELETE FROM speakers WHERE id = ? AND event_id = ?');
  $del->execute([$speakerId, $eventId]);
  json_response(200, ['ok' => true]);
}

// ---- Sessions (Agenda) ----
if (preg_match('#^/events/(\\d+)/sessions$#', $path, $m) && $method === 'GET') {
  $uid = require_organizer_user_id();
  $eventId = (int)$m[1];

  $pdo = db();
  $stmt = $pdo->prepare('SELECT organizer_user_id FROM events WHERE id = ? LIMIT 1');
  $stmt->execute([$eventId]);
  $row = $stmt->fetch();
  if (!$row) json_response(404, ['error' => 'event_not_found']);
  deny_unless_event_row_access($pdo, $row, $uid, 'editor');

  $stmt2 = db()->prepare('SELECT * FROM sessions WHERE event_id = ? ORDER BY starts_at ASC');
  $stmt2->execute([$eventId]);
  $sessions = [];
  while ($s = $stmt2->fetch()) {
    $speakerIds = json_decode($s['speaker_ids_json'], true);
    if (!is_array($speakerIds)) $speakerIds = [];
    $sessions[] = [
      'id' => (string)$s['id'],
      'eventId' => (string)$s['event_id'],
      'title' => $s['title'],
      'description' => $s['description'],
      'startsAt' => gmdate('c', strtotime($s['starts_at'])),
      'endsAt' => gmdate('c', strtotime($s['ends_at'])),
      'location' => $s['location'],
      'speakerIds' => array_map('strval', $speakerIds),
      'createdAt' => gmdate('c', strtotime($s['created_at'])),
    ];
  }
  json_response(200, ['sessions' => $sessions]);
}

if (preg_match('#^/events/(\\d+)/sessions$#', $path, $m) && $method === 'POST') {
  $uid = require_organizer_user_id();
  $eventId = (int)$m[1];
  $body = read_json_body();

  $title = trim((string)($body['title'] ?? ''));
  $description = trim((string)($body['description'] ?? ''));
  $startsAt = (string)($body['startsAt'] ?? '');
  $endsAt = (string)($body['endsAt'] ?? '');
  $location = trim((string)($body['location'] ?? ''));
  $speakerIds = $body['speakerIds'] ?? [];

  if ($title === '' || $startsAt === '' || $endsAt === '') json_response(400, ['error' => 'invalid_session']);
  if (!is_array($speakerIds)) $speakerIds = [];

  $pdo = db();
  $stmt = $pdo->prepare('SELECT organizer_user_id FROM events WHERE id = ? LIMIT 1');
  $stmt->execute([$eventId]);
  $row = $stmt->fetch();
  if (!$row) json_response(404, ['error' => 'event_not_found']);
  deny_unless_event_row_access($pdo, $row, $uid, 'editor');

  $ins = $pdo->prepare('INSERT INTO sessions (event_id, title, description, starts_at, ends_at, location, speaker_ids_json) VALUES (?, ?, ?, ?, ?, ?, ?)');
  $ins->execute([
    $eventId,
    $title,
    $description !== '' ? $description : null,
    date('Y-m-d H:i:s', strtotime($startsAt)),
    date('Y-m-d H:i:s', strtotime($endsAt)),
    $location !== '' ? $location : null,
    json_encode(array_values($speakerIds), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
  ]);
  json_response(201, ['sessionId' => (string)$pdo->lastInsertId()]);
}

if (preg_match('#^/events/(\\d+)/sessions/(\\d+)$#', $path, $m) && $method === 'POST') {
  $uid = require_organizer_user_id();
  $eventId = (int)$m[1];
  $sessionId = (int)$m[2];
  $body = read_json_body();

  $pdo = db();
  $stmt = $pdo->prepare('SELECT organizer_user_id FROM events WHERE id = ? LIMIT 1');
  $stmt->execute([$eventId]);
  $row = $stmt->fetch();
  if (!$row) json_response(404, ['error' => 'event_not_found']);
  deny_unless_event_row_access($pdo, $row, $uid, 'editor');

  $stmt2 = $pdo->prepare('SELECT id FROM sessions WHERE id = ? AND event_id = ? LIMIT 1');
  $stmt2->execute([$sessionId, $eventId]);
  if (!$stmt2->fetch()) json_response(404, ['error' => 'session_not_found']);

  $title = trim((string)($body['title'] ?? ''));
  $description = trim((string)($body['description'] ?? ''));
  $startsAt = (string)($body['startsAt'] ?? '');
  $endsAt = (string)($body['endsAt'] ?? '');
  $location = trim((string)($body['location'] ?? ''));
  $speakerIds = $body['speakerIds'] ?? [];
  if ($title === '' || $startsAt === '' || $endsAt === '') json_response(400, ['error' => 'invalid_session']);
  if (!is_array($speakerIds)) $speakerIds = [];

  $upd = $pdo->prepare('UPDATE sessions SET title = ?, description = ?, starts_at = ?, ends_at = ?, location = ?, speaker_ids_json = ? WHERE id = ? AND event_id = ?');
  $upd->execute([
    $title,
    $description !== '' ? $description : null,
    date('Y-m-d H:i:s', strtotime($startsAt)),
    date('Y-m-d H:i:s', strtotime($endsAt)),
    $location !== '' ? $location : null,
    json_encode(array_values($speakerIds), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
    $sessionId,
    $eventId,
  ]);
  json_response(200, ['ok' => true]);
}

if (preg_match('#^/events/(\\d+)/sessions/(\\d+)/delete$#', $path, $m) && $method === 'POST') {
  $uid = require_organizer_user_id();
  $eventId = (int)$m[1];
  $sessionId = (int)$m[2];

  $pdo = db();
  $stmt = $pdo->prepare('SELECT organizer_user_id FROM events WHERE id = ? LIMIT 1');
  $stmt->execute([$eventId]);
  $row = $stmt->fetch();
  if (!$row) json_response(404, ['error' => 'event_not_found']);
  deny_unless_event_row_access($pdo, $row, $uid, 'editor');

  $del = $pdo->prepare('DELETE FROM sessions WHERE id = ? AND event_id = ?');
  $del->execute([$sessionId, $eventId]);
  json_response(200, ['ok' => true]);
}

// Public: speakers + sessions by event id
if (preg_match('#^/public/events/(\\d+)/speakers$#', $path, $m) && $method === 'GET') {
  $eventId = (int)$m[1];
  require_publishable_event(db(), $eventId);
  $stmt = db()->prepare('SELECT * FROM speakers WHERE event_id = ? ORDER BY id DESC');
  $stmt->execute([$eventId]);
  $speakers = [];
  while ($s = $stmt->fetch()) {
    $speakers[] = [
      'id' => (string)$s['id'],
      'name' => $s['name'],
      'title' => $s['title'],
      'company' => $s['company'],
      'bio' => $s['bio'],
      'avatarUrl' => $s['avatar_url'],
    ];
  }
  json_response(200, ['speakers' => $speakers]);
}

if (preg_match('#^/public/events/(\\d+)/sessions$#', $path, $m) && $method === 'GET') {
  $eventId = (int)$m[1];
  require_publishable_event(db(), $eventId);
  $stmt = db()->prepare('SELECT * FROM sessions WHERE event_id = ? ORDER BY starts_at ASC');
  $stmt->execute([$eventId]);
  $sessions = [];
  while ($s = $stmt->fetch()) {
    $speakerIds = json_decode($s['speaker_ids_json'], true);
    if (!is_array($speakerIds)) $speakerIds = [];
    $sessions[] = [
      'id' => (string)$s['id'],
      'title' => $s['title'],
      'description' => $s['description'],
      'startsAt' => gmdate('c', strtotime($s['starts_at'])),
      'endsAt' => gmdate('c', strtotime($s['ends_at'])),
      'location' => $s['location'],
      'speakerIds' => array_map('strval', $speakerIds),
    ];
  }
  json_response(200, ['sessions' => $sessions]);
}

// ---- Attendees + Check-in ----
if (preg_match('#^/events/(\\d+)/checkin-config$#', $path, $m) && $method === 'GET') {
  $uid = require_organizer_user_id();
  $eventId = (int)$m[1];
  $pdo = db();
  require_event_owner($pdo, $eventId, $uid);
  $pin = get_event_checkin_pin($pdo, $eventId);
  if ($pin === null) {
    $pin = set_event_checkin_pin($pdo, $eventId, null);
  }
  json_response(200, [
    'staffPin' => $pin,
    'staffUrl' => staff_checkin_public_url($eventId),
  ]);
}

if (preg_match('#^/events/(\\d+)/checkin-config$#', $path, $m) && $method === 'POST') {
  $uid = require_organizer_user_id();
  $eventId = (int)$m[1];
  $body = read_json_body();
  $pdo = db();
  require_event_owner($pdo, $eventId, $uid);
  $regenerate = !empty($body['regenerate']);
  $customPin = isset($body['pin']) ? (string)$body['pin'] : null;
  if ($regenerate) {
    $pin = set_event_checkin_pin($pdo, $eventId, null);
  } elseif ($customPin !== null && $customPin !== '') {
    $pin = set_event_checkin_pin($pdo, $eventId, $customPin);
  } else {
    $pin = get_event_checkin_pin($pdo, $eventId);
    if ($pin === null) $pin = set_event_checkin_pin($pdo, $eventId, null);
  }
  json_response(200, [
    'ok' => true,
    'staffPin' => $pin,
    'staffUrl' => staff_checkin_public_url($eventId),
  ]);
}

if (preg_match('#^/events/(\\d+)/checkin/verify-pin$#', $path, $m) && $method === 'POST') {
  $eventId = (int)$m[1];
  $body = read_json_body();
  $pin = normalize_checkin_pin((string)($body['staffPin'] ?? ''));
  if ($pin === '') json_response(400, ['error' => 'invalid_staff_pin']);
  $pdo = db();
  $stmt = $pdo->prepare('SELECT id, title, status FROM events WHERE id = ? LIMIT 1');
  $stmt->execute([$eventId]);
  $ev = $stmt->fetch();
  if (!$ev) json_response(404, ['error' => 'event_not_found']);
  if ((string)$ev['status'] !== 'published') {
    json_response(403, [
      'error' => 'event_not_live',
      'message' => 'This event is not published yet. Publish the event in the dashboard, then try again.',
    ]);
  }
  if (!verify_event_checkin_pin($pdo, $eventId, $pin)) {
    json_response(403, ['error' => 'invalid_staff_pin', 'message' => 'Incorrect PIN for this event.']);
  }
  json_response(200, ['ok' => true, 'eventTitle' => (string)$ev['title']]);
}

if (preg_match('#^/events/(\\d+)/checkin/scans$#', $path, $m) && $method === 'GET') {
  $eventId = (int)$m[1];
  $pin = normalize_checkin_pin((string)($_GET['staffPin'] ?? ''));
  $volunteerSessionId = normalize_volunteer_session_id((string)($_GET['volunteerSessionId'] ?? ''));
  if ($pin === '') json_response(401, ['error' => 'checkin_unauthorized']);
  if ($volunteerSessionId === '') json_response(400, ['error' => 'invalid_volunteer_session']);

  $pdo = db();
  if (!verify_event_checkin_pin($pdo, $eventId, $pin)) {
    json_response(403, ['error' => 'invalid_staff_pin', 'message' => 'Incorrect PIN for this event.']);
  }

  $limit = min(200, max(1, (int)($_GET['limit'] ?? 100)));
  $scans = fetch_volunteer_checkin_scans($pdo, $eventId, $volunteerSessionId, $limit);
  json_response(200, ['scans' => $scans, 'total' => count($scans)]);
}

if (preg_match('#^/events/(\\d+)/attendees$#', $path, $m) && $method === 'GET') {
  $uid = require_organizer_user_id();
  $eventId = (int)$m[1];

  $pdo = db();
  require_event_owner($pdo, $eventId, $uid, 'viewer');

  $q = trim((string)($_GET['q'] ?? ''));
  $status = trim((string)($_GET['status'] ?? 'all'));
  $limit = (int)($_GET['limit'] ?? 500);
  if ($limit < 1) $limit = 1;
  if ($limit > 2000) $limit = 2000;

  $where = 'a.event_id = ?';
  $params = [$eventId];
  if ($status === 'checked_in') {
    $where .= ' AND a.checked_in_at IS NOT NULL';
  } elseif ($status === 'pending') {
    $where .= ' AND a.checked_in_at IS NULL';
  }
  if ($q !== '') {
    $like = '%' . $q . '%';
    $where .= ' AND (a.full_name LIKE ? OR a.email LIKE ? OR a.qr_token LIKE ? OR t.name LIKE ?)';
    array_push($params, $like, $like, $like, $like);
  }

  $sql =
    'SELECT a.id, a.ticket_id, a.full_name, a.email, a.phone, a.qr_token, a.checked_in_at, a.created_at, a.custom_fields_json, t.name AS ticket_name
     FROM attendees a
     JOIN tickets t ON t.id = a.ticket_id
     WHERE ' . $where . '
     ORDER BY a.checked_in_at IS NULL DESC, a.created_at DESC
     LIMIT ?';
  $params[] = $limit;

  $stmt2 = $pdo->prepare($sql);
  $stmt2->execute($params);

  $attendees = [];
  while ($a = $stmt2->fetch()) {
    $attendees[] = attendee_api_shape($a, $eventId);
  }

  json_response(200, ['attendees' => $attendees, 'stats' => fetch_attendee_stats($pdo, $eventId)]);
}

if (preg_match('#^/events/(\\d+)/attendees\\.csv$#', $path, $m) && $method === 'GET') {
  $uid = require_organizer_user_id();
  $eventId = (int)$m[1];

  $pdo = db();
  $stmt = $pdo->prepare('SELECT organizer_user_id FROM events WHERE id = ? LIMIT 1');
  $stmt->execute([$eventId]);
  $row = $stmt->fetch();
  if (!$row) json_response(404, ['error' => 'event_not_found']);
  deny_unless_event_row_access($pdo, $row, $uid, 'editor');

  $evRow = load_event_row_or_404($pdo, $eventId);
  $checkoutFields = checkout_fields_from_event_row($evRow);

  header('Content-Type: text/csv; charset=utf-8');
  header('Content-Disposition: attachment; filename="attendees-event-' . $eventId . '.csv"');
  header('Cache-Control: no-store, max-age=0');

  $out = fopen('php://output', 'w');
  $header = ['attendee_id', 'ticket_name', 'full_name', 'email', 'phone'];
  foreach ($checkoutFields as $field) {
    $header[] = (string)($field['label'] ?? $field['key']);
  }
  array_push($header, 'qr_token', 'checked_in_at', 'created_at');
  fputcsv($out, $header);

  $stmt2 = $pdo->prepare(
    'SELECT a.id, t.name AS ticket_name, a.full_name, a.email, a.phone, a.qr_token, a.checked_in_at, a.created_at, a.custom_fields_json
     FROM attendees a
     JOIN tickets t ON t.id = a.ticket_id
     WHERE a.event_id = ?
     ORDER BY a.created_at DESC'
  );
  $stmt2->execute([$eventId]);
  while ($a = $stmt2->fetch()) {
    $custom = decode_attendee_custom_fields($a['custom_fields_json'] ?? null) ?? [];
    $row = [
      (string)$a['id'],
      $a['ticket_name'],
      $a['full_name'],
      $a['email'],
      $a['phone'],
    ];
    foreach ($checkoutFields as $field) {
      $key = (string)($field['key'] ?? '');
      $row[] = $key !== '' ? (string)($custom[$key] ?? '') : '';
    }
    array_push($row, $a['qr_token'], $a['checked_in_at'], $a['created_at']);
    fputcsv($out, $row);
  }
  fclose($out);
  exit;
}

if (preg_match('#^/events/(\\d+)/checkin/undo$#', $path, $m) && $method === 'POST') {
  $uid = require_organizer_user_id();
  $eventId = (int)$m[1];
  $body = read_json_body();
  $token = normalize_qr_token_lookup((string)($body['qrToken'] ?? ''));
  if ($token === '') json_response(400, ['error' => 'invalid_qr_token']);
  $pdo = db();
  require_event_owner($pdo, $eventId, $uid);

  $stmt2 = $pdo->prepare(
    'SELECT a.id, a.ticket_id, a.full_name, a.email, a.phone, a.qr_token, a.checked_in_at, a.created_at, t.name AS ticket_name
     FROM attendees a
     JOIN tickets t ON t.id = a.ticket_id
     WHERE a.event_id = ? AND LOWER(a.qr_token) = ?
     LIMIT 1'
  );
  $stmt2->execute([$eventId, $token]);
  $a = $stmt2->fetch();
  if (!$a) json_response(404, ['error' => 'attendee_not_found', 'message' => 'No ticket found for this code.']);

  $upd = $pdo->prepare('UPDATE attendees SET checked_in_at = NULL WHERE id = ?');
  $upd->execute([(int)$a['id']]);
  $a['checked_in_at'] = null;
  json_response(200, ['ok' => true, 'attendee' => attendee_api_shape($a, $eventId)]);
}

if (preg_match('#^/events/(\\d+)/checkin$#', $path, $m) && $method === 'POST') {
  $eventId = (int)$m[1];
  $body = read_json_body();
  $token = normalize_qr_token_lookup((string)($body['qrToken'] ?? ''));
  if ($token === '') json_response(400, ['error' => 'invalid_qr_token', 'message' => 'Scan a valid ticket QR code.']);

  $pdo = db();
  require_checkin_access($pdo, $eventId, $body);

  $stmt2 = $pdo->prepare(
    'SELECT a.id, a.ticket_id, a.full_name, a.email, a.phone, a.qr_token, a.checked_in_at, a.created_at, t.name AS ticket_name
     FROM attendees a
     JOIN tickets t ON t.id = a.ticket_id
     WHERE a.event_id = ? AND LOWER(a.qr_token) = ?
     LIMIT 1'
  );
  $stmt2->execute([$eventId, $token]);
  $a = $stmt2->fetch();
  if (!$a) json_response(404, ['error' => 'attendee_not_found', 'message' => 'Ticket not found. Check the QR code or token.']);

  $attendee = attendee_api_shape($a, $eventId);
  $volunteerSessionId = normalize_volunteer_session_id((string)($body['volunteerSessionId'] ?? ''));

  if ($a['checked_in_at']) {
    if ($volunteerSessionId !== '') {
      log_volunteer_checkin_scan($pdo, $eventId, $volunteerSessionId, $attendee, 'already_checked_in');
    }
    json_response(200, [
      'ok' => true,
      'alreadyCheckedIn' => true,
      'checkedInAt' => $attendee['checkedInAt'],
      'attendee' => $attendee,
      'message' => $attendee['fullName'] . ' was already checked in.',
    ]);
  }

  $now = date('Y-m-d H:i:s');
  $upd = $pdo->prepare('UPDATE attendees SET checked_in_at = ? WHERE id = ?');
  $upd->execute([$now, (int)$a['id']]);
  $a['checked_in_at'] = $now;
  $attendee = attendee_api_shape($a, $eventId);
  if ($volunteerSessionId !== '') {
    log_volunteer_checkin_scan($pdo, $eventId, $volunteerSessionId, $attendee, 'success');
  }
  json_response(200, [
    'ok' => true,
    'alreadyCheckedIn' => false,
    'checkedInAt' => $attendee['checkedInAt'],
    'attendee' => $attendee,
    'message' => 'Welcome, ' . $attendee['fullName'] . '!',
  ]);
}

// ---- Organizer runbook (private event checklist) ----
if (preg_match('#^/events/(\\d+)/runbook$#', $path, $m) && $method === 'GET') {
  $uid = require_organizer_user_id();
  $eventId = (int)$m[1];
  $pdo = db();

  $stmt = $pdo->prepare('SELECT organizer_user_id FROM events WHERE id = ? LIMIT 1');
  $stmt->execute([$eventId]);
  $row = $stmt->fetch();
  if (!$row) json_response(404, ['error' => 'event_not_found']);
  deny_unless_event_row_access($pdo, $row, $uid, 'editor');

  ensure_event_runbook_table($pdo);
  $stmt2 = $pdo->prepare('SELECT id, title, priority, status, due_at, created_at FROM event_runbook_items WHERE event_id = ? ORDER BY status ASC, created_at DESC');
  $stmt2->execute([$eventId]);
  $items = [];
  while ($r = $stmt2->fetch()) {
    $items[] = [
      'id' => (string)$r['id'],
      'eventId' => (string)$eventId,
      'title' => $r['title'],
      'priority' => $r['priority'],
      'status' => $r['status'],
      'dueAt' => $r['due_at'] ? gmdate('c', strtotime($r['due_at'])) : null,
      'createdAt' => gmdate('c', strtotime($r['created_at'])),
    ];
  }
  json_response(200, ['items' => $items]);
}

if (preg_match('#^/events/(\\d+)/runbook$#', $path, $m) && $method === 'POST') {
  $uid = require_organizer_user_id();
  $eventId = (int)$m[1];
  $body = read_json_body();
  $title = trim((string)($body['title'] ?? ''));
  $priority = trim((string)($body['priority'] ?? 'medium'));
  $dueAt = trim((string)($body['dueAt'] ?? ''));
  if ($title === '') json_response(400, ['error' => 'invalid_title']);
  if (!in_array($priority, ['low', 'medium', 'high'], true)) $priority = 'medium';

  $pdo = db();
  $stmt = $pdo->prepare('SELECT organizer_user_id FROM events WHERE id = ? LIMIT 1');
  $stmt->execute([$eventId]);
  $row = $stmt->fetch();
  if (!$row) json_response(404, ['error' => 'event_not_found']);
  deny_unless_event_row_access($pdo, $row, $uid, 'editor');

  ensure_event_runbook_table($pdo);
  $ins = $pdo->prepare('INSERT INTO event_runbook_items (event_id, title, priority, status, due_at) VALUES (?, ?, ?, ?, ?)');
  $ins->execute([
    $eventId,
    $title,
    $priority,
    'open',
    $dueAt !== '' ? date('Y-m-d H:i:s', strtotime($dueAt)) : null,
  ]);
  json_response(201, ['id' => (string)$pdo->lastInsertId()]);
}

if (preg_match('#^/events/(\\d+)/runbook/(\\d+)/toggle$#', $path, $m) && $method === 'POST') {
  $uid = require_organizer_user_id();
  $eventId = (int)$m[1];
  $itemId = (int)$m[2];
  $pdo = db();

  $stmt = $pdo->prepare('SELECT organizer_user_id FROM events WHERE id = ? LIMIT 1');
  $stmt->execute([$eventId]);
  $row = $stmt->fetch();
  if (!$row) json_response(404, ['error' => 'event_not_found']);
  deny_unless_event_row_access($pdo, $row, $uid, 'editor');

  ensure_event_runbook_table($pdo);
  $s = $pdo->prepare('SELECT status FROM event_runbook_items WHERE id = ? AND event_id = ? LIMIT 1');
  $s->execute([$itemId, $eventId]);
  $r = $s->fetch();
  if (!$r) json_response(404, ['error' => 'item_not_found']);
  $next = $r['status'] === 'done' ? 'open' : 'done';
  $u = $pdo->prepare('UPDATE event_runbook_items SET status = ? WHERE id = ?');
  $u->execute([$next, $itemId]);
  json_response(200, ['status' => $next]);
}

if (preg_match('#^/events/(\\d+)/runbook/(\\d+)/delete$#', $path, $m) && $method === 'POST') {
  $uid = require_organizer_user_id();
  $eventId = (int)$m[1];
  $itemId = (int)$m[2];
  $pdo = db();

  $stmt = $pdo->prepare('SELECT organizer_user_id FROM events WHERE id = ? LIMIT 1');
  $stmt->execute([$eventId]);
  $row = $stmt->fetch();
  if (!$row) json_response(404, ['error' => 'event_not_found']);
  deny_unless_event_row_access($pdo, $row, $uid, 'editor');

  ensure_event_runbook_table($pdo);
  $d = $pdo->prepare('DELETE FROM event_runbook_items WHERE id = ? AND event_id = ?');
  $d->execute([$itemId, $eventId]);
  json_response(200, ['ok' => true]);
}

if ($path === '/admin/summary' && $method === 'GET') {
  require_super_admin_user_id();
  $pdo = db();
  ensure_finance_tables($pdo);

  $sumTx = $pdo->query(
    "SELECT
      COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN amount_cents ELSE 0 END), 0) AS total_revenue,
      COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN platform_fee_cents ELSE 0 END), 0) AS total_platform_fee,
      COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN organizer_amount_cents ELSE 0 END), 0) AS total_organizer_amount,
      COALESCE(SUM(CASE WHEN payment_status = 'failed' THEN 1 ELSE 0 END), 0) AS failed_count,
      COALESCE(SUM(CASE WHEN refund_requested = 1 THEN 1 ELSE 0 END), 0) AS refund_requests,
      COUNT(*) AS tx_count,
      COALESCE(SUM(CASE WHEN payment_status = 'paid' AND date(created_at) = date('now') THEN amount_cents ELSE 0 END), 0) AS today_revenue
     FROM transactions"
  )->fetch();
  $dbDriver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  if ($dbDriver === 'mysql' || $dbDriver === 'pgsql') {
    $sumTx = $pdo->query(
      "SELECT
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN amount_cents ELSE 0 END), 0) AS total_revenue,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN platform_fee_cents ELSE 0 END), 0) AS total_platform_fee,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN organizer_amount_cents ELSE 0 END), 0) AS total_organizer_amount,
        COALESCE(SUM(CASE WHEN payment_status = 'failed' THEN 1 ELSE 0 END), 0) AS failed_count,
        COALESCE(SUM(CASE WHEN refund_requested = 1 THEN 1 ELSE 0 END), 0) AS refund_requests,
        COUNT(*) AS tx_count,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' AND DATE(created_at) = CURRENT_DATE THEN amount_cents ELSE 0 END), 0) AS today_revenue
      FROM transactions"
    )->fetch();
  }
  $sumPayouts = $pdo->query(
    "SELECT
      COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount_cents ELSE 0 END), 0) AS total_paid_out,
      COALESCE(SUM(CASE WHEN status IN ('pending','processing') THEN total_amount_cents ELSE 0 END), 0) AS pending_amount,
      COALESCE(SUM(CASE WHEN status IN ('pending','processing') THEN 1 ELSE 0 END), 0) AS pending_count
     FROM payouts"
  )->fetch();

  $counts = $pdo->query("SELECT
      (SELECT COUNT(*) FROM users) AS total_users,
      (SELECT COUNT(*) FROM events) AS total_events,
      (SELECT COUNT(*) FROM events WHERE status = 'published') AS active_events
    ")->fetch();
  $topEvents = $pdo->query(
    "SELECT e.id, e.title, COALESCE(SUM(CASE WHEN t.payment_status='paid' THEN t.amount_cents ELSE 0 END),0) AS revenue_cents
     FROM events e
     LEFT JOIN transactions t ON t.event_id = e.id
     GROUP BY e.id, e.title
     ORDER BY revenue_cents DESC
     LIMIT 5"
  )->fetchAll();
  $topOrganizers = $pdo->query(
    "SELECT u.id, u.display_name, COALESCE(SUM(CASE WHEN t.payment_status='paid' THEN t.organizer_amount_cents ELSE 0 END),0) AS earnings_cents
     FROM users u
     LEFT JOIN events e ON e.organizer_user_id = u.id
     LEFT JOIN transactions t ON t.event_id = e.id
     WHERE u.role = 'organizer'
     GROUP BY u.id, u.display_name
     ORDER BY earnings_cents DESC
     LIMIT 5"
  )->fetchAll();
  json_response(200, [
    'summary' => [
      'totalRevenue' => ((int)($sumTx['total_revenue'] ?? 0)) / 100,
      'todayRevenue' => ((int)($sumTx['today_revenue'] ?? 0)) / 100,
      'totalPlatformFees' => ((int)($sumTx['total_platform_fee'] ?? 0)) / 100,
      'totalOrganizerEarnings' => ((int)($sumTx['total_organizer_amount'] ?? 0)) / 100,
      'totalPaidOut' => ((int)($sumPayouts['total_paid_out'] ?? 0)) / 100,
      'pendingPayoutAmount' => ((int)($sumPayouts['pending_amount'] ?? 0)) / 100,
      'pendingPayoutCount' => (int)($sumPayouts['pending_count'] ?? 0),
      'transactionCount' => (int)($sumTx['tx_count'] ?? 0),
      'failedPayments' => (int)($sumTx['failed_count'] ?? 0),
      'refundRequests' => (int)($sumTx['refund_requests'] ?? 0),
      'totalUsers' => (int)($counts['total_users'] ?? 0),
      'totalEvents' => (int)($counts['total_events'] ?? 0),
      'activeEvents' => (int)($counts['active_events'] ?? 0),
      'topEvents' => array_map(fn($r) => ['id' => (string)$r['id'], 'title' => $r['title'], 'revenue' => ((int)$r['revenue_cents']) / 100], $topEvents ?: []),
      'topOrganizers' => array_map(fn($r) => ['id' => (string)$r['id'], 'name' => $r['display_name'], 'earnings' => ((int)$r['earnings_cents']) / 100], $topOrganizers ?: []),
      'charts' => admin_build_chart_payload($pdo),
    ],
  ]);
}

if ($path === '/admin/users' && $method === 'GET') {
  require_super_admin_user_id();
  $pdo = db();
  $q = trim((string)($_GET['q'] ?? ''));
  $role = trim((string)($_GET['role'] ?? ''));
  $status = trim((string)($_GET['status'] ?? ''));
  $sql = 'SELECT id, email, display_name, role, is_blocked, status, force_password_reset, created_at FROM users WHERE 1=1';
  $params = [];
  if ($q !== '') {
    $sql .= ' AND (LOWER(email) LIKE ? OR LOWER(display_name) LIKE ?)';
    $like = '%' . strtolower($q) . '%';
    $params[] = $like;
    $params[] = $like;
  }
  if (in_array($role, ['organizer', 'attendee', 'super_admin'], true)) {
    $sql .= ' AND role = ?';
    $params[] = $role;
  }
  if (in_array($status, ['active', 'suspended', 'banned'], true)) {
    $sql .= ' AND status = ?';
    $params[] = $status;
  }
  $sql .= ' ORDER BY created_at DESC LIMIT 500';
  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  $users = [];
  while ($u = $stmt->fetch()) {
    $users[] = [
      'id' => (string)$u['id'],
      'email' => $u['email'],
      'displayName' => $u['display_name'],
      'role' => $u['role'],
      'isBlocked' => (int)($u['is_blocked'] ?? 0) === 1,
      'status' => (string)($u['status'] ?? 'active'),
      'forcePasswordReset' => boolish($u['force_password_reset'] ?? 0),
      'createdAt' => gmdate('c', strtotime($u['created_at'])),
    ];
  }
  json_response(200, ['users' => $users]);
}

if (preg_match('#^/admin/users/(\\d+)/status$#', $path, $m) && $method === 'POST') {
  $adminId = require_super_admin_user_id();
  $admin = load_user_profile($adminId);
  $userId = (int)$m[1];
  $body = read_json_body();
  $status = (string)($body['status'] ?? (boolish($body['blocked'] ?? false) ? 'banned' : 'active'));
  if (!in_array($status, ['active', 'suspended', 'banned'], true)) json_response(400, ['error' => 'invalid_user_status']);
  $blocked = $status !== 'active';
  $upd = db()->prepare('UPDATE users SET status = ?, is_blocked = ? WHERE id = ?');
  $upd->execute([$status, $blocked ? 1 : 0, $userId]);
  write_log(db(), $adminId, (string)$admin['role'], 'admin.user.status_changed', 'user', (string)$userId, ['status' => $status]);
  json_response(200, ['ok' => true]);
}

if (preg_match('#^/admin/users/(\\d+)/role$#', $path, $m) && $method === 'POST') {
  $adminId = require_super_admin_user_id();
  $userId = (int)$m[1];
  if ($adminId === $userId) json_response(400, ['error' => 'cannot_change_own_role']);
  $role = (string)(read_json_body()['role'] ?? '');
  if (!in_array($role, ['attendee', 'organizer', 'super_admin'], true)) json_response(400, ['error' => 'invalid_role']);
  $upd = db()->prepare('UPDATE users SET role = ? WHERE id = ?');
  $upd->execute([$role, $userId]);
  write_log(db(), $adminId, 'super_admin', 'admin.user.role_changed', 'user', (string)$userId, ['role' => $role]);
  json_response(200, ['ok' => true]);
}

if (preg_match('#^/admin/users/(\\d+)/force-password-reset$#', $path, $m) && $method === 'POST') {
  $adminId = require_super_admin_user_id();
  $userId = (int)$m[1];
  $upd = db()->prepare('UPDATE users SET force_password_reset = 1 WHERE id = ?');
  $upd->execute([$userId]);
  write_log(db(), $adminId, 'super_admin', 'admin.user.force_password_reset', 'user', (string)$userId, null);
  json_response(200, ['ok' => true]);
}

if (preg_match('#^/admin/users/(\\d+)$#', $path, $m) && $method === 'GET') {
  require_super_admin_user_id();
  $userId = (int)$m[1];
  $pdo = db();
  $u = $pdo->prepare('SELECT id, email, display_name, role, status, created_at FROM users WHERE id = ? LIMIT 1');
  $u->execute([$userId]);
  $user = $u->fetch();
  if (!$user) json_response(404, ['error' => 'user_not_found']);
  $stats = $pdo->prepare("SELECT
      (SELECT COUNT(*) FROM events WHERE organizer_user_id = ?) AS events_count,
      (SELECT COUNT(*) FROM orders WHERE buyer_user_id = ?) AS orders_count,
      (SELECT COALESCE(SUM(amount_cents),0) FROM transactions WHERE user_id = ? AND payment_status='paid') AS paid_amount_cents");
  $stats->execute([$userId, $userId, $userId]);
  $s = $stats->fetch();
  json_response(200, ['user' => [
    'id' => (string)$user['id'],
    'email' => $user['email'],
    'displayName' => $user['display_name'],
    'role' => $user['role'],
    'status' => $user['status'],
    'createdAt' => gmdate('c', strtotime($user['created_at'])),
    'stats' => [
      'eventsCount' => (int)($s['events_count'] ?? 0),
      'ordersCount' => (int)($s['orders_count'] ?? 0),
      'paidAmount' => ((int)($s['paid_amount_cents'] ?? 0)) / 100,
    ],
  ]]);
}

if ($path === '/admin/events' && $method === 'GET') {
  require_super_admin_user_id();
  $pdo = db();
  $status = trim((string)($_GET['status'] ?? ''));
  $q = trim((string)($_GET['q'] ?? ''));
  $sql = 'SELECT e.id, e.slug, e.title, e.status, e.event_status, e.is_featured, e.created_at, u.display_name AS organizer_name,
    (SELECT COUNT(*) FROM attendees a WHERE a.event_id = e.id) AS attendee_total,
    (SELECT COUNT(*) FROM attendees a WHERE a.event_id = e.id AND a.checked_in_at IS NOT NULL) AS attendee_checked_in
    FROM events e JOIN users u ON u.id = e.organizer_user_id WHERE 1=1';
  $params = [];
  if (in_array($status, ['pending', 'approved', 'rejected', 'suspended'], true)) {
    $sql .= ' AND e.event_status = ?';
    $params[] = $status;
  }
  if ($q !== '') {
    $sql .= ' AND (LOWER(e.title) LIKE ? OR LOWER(e.slug) LIKE ?)';
    $like = '%' . strtolower($q) . '%';
    $params[] = $like;
    $params[] = $like;
  }
  $sql .= ' ORDER BY e.created_at DESC LIMIT 500';
  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  $events = [];
  while ($e = $stmt->fetch()) {
    $attendeeTotal = (int)($e['attendee_total'] ?? 0);
    $attendeeCheckedIn = (int)($e['attendee_checked_in'] ?? 0);
    $events[] = [
      'id' => (string)$e['id'],
      'slug' => $e['slug'],
      'title' => $e['title'],
      'status' => $e['status'],
      'eventStatus' => (string)($e['event_status'] ?? 'approved'),
      'isFeatured' => boolish($e['is_featured'] ?? 0),
      'organizerName' => $e['organizer_name'],
      'createdAt' => gmdate('c', strtotime($e['created_at'])),
      'attendeeStats' => [
        'total' => $attendeeTotal,
        'checkedIn' => $attendeeCheckedIn,
        'pending' => max(0, $attendeeTotal - $attendeeCheckedIn),
      ],
    ];
  }
  json_response(200, ['events' => $events]);
}

if (preg_match('#^/admin/events/(\\d+)/status$#', $path, $m) && $method === 'POST') {
  $adminId = require_super_admin_user_id();
  $eventId = (int)$m[1];
  $body = read_json_body();
  $status = (string)($body['status'] ?? '');
  if (!in_array($status, ['draft', 'published', 'cancelled', 'blocked'], true)) json_response(400, ['error' => 'invalid_status']);
  $upd = db()->prepare('UPDATE events SET status = ? WHERE id = ?');
  $upd->execute([$status, $eventId]);
  write_log(db(), $adminId, 'super_admin', 'admin.event.status_changed', 'event', (string)$eventId, ['status' => $status]);
  json_response(200, ['ok' => true]);
}

if (preg_match('#^/admin/events/(\\d+)/moderate$#', $path, $m) && $method === 'POST') {
  $adminId = require_super_admin_user_id();
  $eventId = (int)$m[1];
  $body = read_json_body();
  $eventStatus = (string)($body['eventStatus'] ?? '');
  $isFeatured = array_key_exists('isFeatured', $body) ? (boolish($body['isFeatured']) ? 1 : 0) : null;
  if ($eventStatus !== '' && !in_array($eventStatus, ['pending', 'approved', 'rejected', 'suspended'], true)) {
    json_response(400, ['error' => 'invalid_event_status']);
  }
  $set = [];
  $params = [];
  if ($eventStatus !== '') {
    $set[] = 'event_status = ?';
    $params[] = $eventStatus;
  }
  if ($isFeatured !== null) {
    $set[] = 'is_featured = ?';
    $params[] = $isFeatured;
  }
  if (!$set) json_response(400, ['error' => 'no_changes']);
  $params[] = $eventId;
  $upd = db()->prepare('UPDATE events SET ' . implode(', ', $set) . ' WHERE id = ?');
  $upd->execute($params);
  write_log(db(), $adminId, 'super_admin', 'admin.event.moderated', 'event', (string)$eventId, ['eventStatus' => $eventStatus, 'isFeatured' => $isFeatured === 1]);
  json_response(200, ['ok' => true]);
}

if (preg_match('#^/admin/events/(\\d+)$#', $path, $m) && $method === 'GET') {
  require_super_admin_user_id();
  $eventId = (int)$m[1];
  $pdo = db();
  $stmt = $pdo->prepare(
    'SELECT e.*, u.display_name AS organizer_name, u.email AS organizer_email
     FROM events e
     JOIN users u ON u.id = e.organizer_user_id
     WHERE e.id = ?
     LIMIT 1'
  );
  $stmt->execute([$eventId]);
  $e = $stmt->fetch();
  if (!$e) json_response(404, ['error' => 'event_not_found']);

  $orderStmt = $pdo->prepare(
    "SELECT
       COUNT(*) AS orders_count,
       COALESCE(SUM(total_amount_cents), 0) AS revenue_cents
     FROM orders
     WHERE event_id = ? AND status = 'paid'"
  );
  $orderStmt->execute([$eventId]);
  $orders = $orderStmt->fetch() ?: ['orders_count' => 0, 'revenue_cents' => 0];

  $ticketStmt = $pdo->prepare(
    'SELECT t.id, t.name, t.price_cents, t.quantity,
       (SELECT COUNT(*) FROM attendees a WHERE a.ticket_id = t.id) AS sold
     FROM tickets t
     WHERE t.event_id = ?
     ORDER BY t.id ASC'
  );
  $ticketStmt->execute([$eventId]);
  $tickets = [];
  while ($t = $ticketStmt->fetch()) {
    $tickets[] = [
      'id' => (string)$t['id'],
      'name' => (string)$t['name'],
      'price' => ((int)$t['price_cents']) / 100,
      'quantity' => $t['quantity'] !== null ? (int)$t['quantity'] : null,
      'sold' => (int)$t['sold'],
    ];
  }

  json_response(200, [
    'event' => [
      'id' => (string)$e['id'],
      'slug' => (string)$e['slug'],
      'title' => (string)$e['title'],
      'status' => (string)$e['status'],
      'eventStatus' => (string)($e['event_status'] ?? 'approved'),
      'isFeatured' => boolish($e['is_featured'] ?? 0),
      'date' => !empty($e['date']) ? gmdate('c', strtotime($e['date'])) : null,
      'location' => $e['location'] ?? null,
      'createdAt' => gmdate('c', strtotime($e['created_at'])),
      'organizerName' => (string)$e['organizer_name'],
      'organizerEmail' => (string)$e['organizer_email'],
    ],
    'attendeeStats' => fetch_attendee_stats($pdo, $eventId),
    'orders' => [
      'paidCount' => (int)$orders['orders_count'],
      'revenue' => ((int)$orders['revenue_cents']) / 100,
    ],
    'tickets' => $tickets,
  ]);
}

if (preg_match('#^/admin/events/(\\d+)/attendees$#', $path, $m) && $method === 'GET') {
  require_super_admin_user_id();
  $eventId = (int)$m[1];
  $pdo = db();
  $exists = $pdo->prepare('SELECT id FROM events WHERE id = ? LIMIT 1');
  $exists->execute([$eventId]);
  if (!$exists->fetch()) json_response(404, ['error' => 'event_not_found']);

  $q = trim((string)($_GET['q'] ?? ''));
  $status = trim((string)($_GET['status'] ?? 'all'));
  $limit = (int)($_GET['limit'] ?? 500);
  if ($limit < 1) $limit = 1;
  if ($limit > 2000) $limit = 2000;

  $where = 'a.event_id = ?';
  $params = [$eventId];
  if ($status === 'checked_in') {
    $where .= ' AND a.checked_in_at IS NOT NULL';
  } elseif ($status === 'pending') {
    $where .= ' AND a.checked_in_at IS NULL';
  }
  if ($q !== '') {
    $like = '%' . $q . '%';
    $where .= ' AND (a.full_name LIKE ? OR a.email LIKE ? OR a.qr_token LIKE ? OR t.name LIKE ?)';
    array_push($params, $like, $like, $like, $like);
  }

  $sql =
    'SELECT a.id, a.ticket_id, a.full_name, a.email, a.phone, a.qr_token, a.checked_in_at, a.created_at, a.custom_fields_json, t.name AS ticket_name
     FROM attendees a
     JOIN tickets t ON t.id = a.ticket_id
     WHERE ' . $where . '
     ORDER BY a.checked_in_at IS NULL DESC, a.created_at DESC
     LIMIT ?';
  $params[] = $limit;

  $stmt2 = $pdo->prepare($sql);
  $stmt2->execute($params);

  $attendees = [];
  while ($a = $stmt2->fetch()) {
    $attendees[] = attendee_api_shape($a, $eventId);
  }

  json_response(200, ['attendees' => $attendees, 'stats' => fetch_attendee_stats($pdo, $eventId)]);
}

if ($path === '/admin/transactions' && $method === 'GET') {
  require_super_admin_user_id();
  $pdo = db();
  ensure_finance_tables($pdo);
  $qStatus = trim((string)($_GET['status'] ?? ''));
  $qEventId = (int)($_GET['eventId'] ?? 0);
  $qOrganizerId = (int)($_GET['organizerId'] ?? 0);
  $qFrom = trim((string)($_GET['from'] ?? ''));
  $qTo = trim((string)($_GET['to'] ?? ''));
  $sql = 'SELECT t.id, t.event_id, t.user_id, t.amount_cents, t.platform_fee_cents, t.organizer_amount_cents, t.payment_status, t.payhere_reference, t.is_flagged, t.admin_note, t.refund_requested, t.created_at
     FROM transactions t
     JOIN events e ON e.id = t.event_id
     WHERE 1=1';
  $params = [];
  if (in_array($qStatus, ['pending', 'paid', 'failed'], true)) {
    $sql .= ' AND t.payment_status = ?';
    $params[] = $qStatus;
  }
  if ($qEventId > 0) {
    $sql .= ' AND t.event_id = ?';
    $params[] = $qEventId;
  }
  if ($qOrganizerId > 0) {
    $sql .= ' AND e.organizer_user_id = ?';
    $params[] = $qOrganizerId;
  }
  if ($qFrom !== '') {
    $sql .= ' AND date(t.created_at) >= date(?)';
    $params[] = $qFrom;
  }
  if ($qTo !== '') {
    $sql .= ' AND date(t.created_at) <= date(?)';
    $params[] = $qTo;
  }
  $sql .= ' ORDER BY t.created_at DESC LIMIT 500';
  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  $tx = [];
  while ($r = $stmt->fetch()) {
    $tx[] = [
      'id' => (string)$r['id'],
      'eventId' => (string)$r['event_id'],
      'userId' => $r['user_id'] !== null ? (string)$r['user_id'] : null,
      'amount' => ((int)$r['amount_cents']) / 100,
      'platformFee' => ((int)$r['platform_fee_cents']) / 100,
      'organizerAmount' => ((int)$r['organizer_amount_cents']) / 100,
      'paymentStatus' => $r['payment_status'],
      'payhereReference' => $r['payhere_reference'],
      'isFlagged' => boolish($r['is_flagged'] ?? 0),
      'adminNote' => $r['admin_note'],
      'refundRequested' => boolish($r['refund_requested'] ?? 0),
      'createdAt' => gmdate('c', strtotime($r['created_at'])),
    ];
  }
  json_response(200, ['transactions' => $tx]);
}

if (preg_match('#^/admin/transactions/(\\d+)$#', $path, $m) && $method === 'POST') {
  $adminId = require_super_admin_user_id();
  $txId = (int)$m[1];
  $body = read_json_body();
  $isFlagged = boolish($body['isFlagged'] ?? false) ? 1 : 0;
  $adminNote = trim((string)($body['adminNote'] ?? ''));
  $refundRequested = boolish($body['refundRequested'] ?? false) ? 1 : 0;
  $upd = db()->prepare('UPDATE transactions SET is_flagged = ?, admin_note = ?, refund_requested = ? WHERE id = ?');
  $upd->execute([$isFlagged, $adminNote !== '' ? $adminNote : null, $refundRequested, $txId]);
  write_log(db(), $adminId, 'super_admin', 'admin.transaction.updated', 'transaction', (string)$txId, ['isFlagged' => $isFlagged === 1, 'refundRequested' => $refundRequested === 1]);
  json_response(200, ['ok' => true]);
}

if ($path === '/admin/organizers' && $method === 'GET') {
  require_super_admin_user_id();
  $pdo = db();
  ensure_finance_tables($pdo);
  ensure_organizer_profile_paid_event_columns($pdo);
  $q = trim((string)($_GET['q'] ?? ''));
  $sql = "SELECT u.id, u.display_name, u.email, u.status, u.created_at FROM users u WHERE u.role = 'organizer'";
  $params = [];
  if ($q !== '') {
    $sql .= ' AND (LOWER(u.display_name) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(COALESCE((SELECT organization_name FROM organizer_profiles p WHERE p.user_id = u.id LIMIT 1), \'\')) LIKE ?)';
    $like = '%' . strtolower($q) . '%';
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
  }
  $sql .= ' ORDER BY u.created_at DESC LIMIT 500';
  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  $organizers = [];
  while ($u = $stmt->fetch()) {
    $oid = (int)$u['id'];
    $profile = organizer_profile_api_shape($pdo, $oid);
    $readiness = organizer_paid_event_readiness_api_shape($pdo, $oid);
    $commission = organizer_commission_config($pdo, $oid);
    $balStmt = $pdo->prepare(
      "SELECT
        COALESCE(SUM(CASE WHEN t.payment_status='paid' THEN t.amount_cents ELSE 0 END),0) AS gross_cents,
        COALESCE(SUM(CASE WHEN t.payment_status='paid' THEN t.organizer_amount_cents ELSE 0 END),0) AS net_cents,
        COALESCE((SELECT SUM(p.total_amount_cents) FROM payouts p WHERE p.organizer_id = ? AND p.status IN ('processing','completed')),0) AS paid_cents,
        (SELECT COUNT(*) FROM events e WHERE e.organizer_user_id = ?) AS events_count
       FROM events e
       LEFT JOIN transactions t ON t.event_id = e.id
       WHERE e.organizer_user_id = ?"
    );
    $balStmt->execute([$oid, $oid, $oid]);
    $b = $balStmt->fetch() ?: ['gross_cents' => 0, 'net_cents' => 0, 'paid_cents' => 0, 'events_count' => 0];
    $net = (int)$b['net_cents'];
    $paid = (int)$b['paid_cents'];
    $organizers[] = [
      'organizerId' => (string)$oid,
      'displayName' => (string)$u['display_name'],
      'email' => (string)$u['email'],
      'status' => (string)$u['status'],
      'createdAt' => gmdate('c', strtotime($u['created_at'])),
      'organizationName' => $profile['organizationName'],
      'phone' => $profile['phone'],
      'businessAddress' => $profile['businessAddress'],
      'businessRegistrationNo' => $profile['businessRegistrationNo'],
      'businessRegistrationDocUploaded' => $profile['businessRegistrationDocUploaded'],
      'bankStatementDocUploaded' => $profile['bankStatementDocUploaded'],
      'bankAccountConfigured' => $profile['bankAccountConfigured'],
      'bankName' => $profile['bankName'],
      'bankBranch' => $profile['bankBranch'],
      'bankAccountHolderName' => $profile['bankAccountHolderName'],
      'bankAccountNumberLast4' => $profile['bankAccountNumberLast4'],
      'paidEventReady' => (bool)($readiness['isReady'] ?? false),
      'gatewayMode' => (string)($readiness['gatewayMode'] ?? 'turnout'),
      'commissionMode' => (string)($commission['mode'] ?? 'percentage'),
      'commissionValue' => (float)($commission['value'] ?? get_platform_commission_pct($pdo)),
      'eventsCount' => (int)($b['events_count'] ?? 0),
      'grossRevenue' => ((int)$b['gross_cents']) / 100,
      'netEarnings' => $net / 100,
      'paidOut' => $paid / 100,
      'availableBalance' => max(0, $net - $paid) / 100,
    ];
  }
  json_response(200, ['organizers' => $organizers]);
}

if (preg_match('#^/admin/organizers/(\\d+)$#', $path, $m) && $method === 'GET') {
  require_super_admin_user_id();
  $organizerId = (int)$m[1];
  $pdo = db();
  ensure_finance_tables($pdo);
  ensure_organizer_profile_paid_event_columns($pdo);
  $u = $pdo->prepare('SELECT id, email, display_name, role, status, created_at FROM users WHERE id = ? AND role = ? LIMIT 1');
  $u->execute([$organizerId, 'organizer']);
  $user = $u->fetch();
  if (!$user) json_response(404, ['error' => 'organizer_not_found']);

  $balStmt = $pdo->prepare(
    "SELECT
      COALESCE(SUM(CASE WHEN t.payment_status='paid' THEN t.amount_cents ELSE 0 END),0) AS gross_cents,
      COALESCE(SUM(CASE WHEN t.payment_status='paid' THEN t.platform_fee_cents ELSE 0 END),0) AS fees_cents,
      COALESCE(SUM(CASE WHEN t.payment_status='paid' THEN t.organizer_amount_cents ELSE 0 END),0) AS net_cents,
      COALESCE((SELECT SUM(p.total_amount_cents) FROM payouts p WHERE p.organizer_id = ? AND p.status IN ('processing','completed')),0) AS paid_cents
     FROM events e
     LEFT JOIN transactions t ON t.event_id = e.id
     WHERE e.organizer_user_id = ?"
  );
  $balStmt->execute([$organizerId, $organizerId]);
  $b = $balStmt->fetch() ?: ['gross_cents' => 0, 'fees_cents' => 0, 'net_cents' => 0, 'paid_cents' => 0];
  $net = (int)$b['net_cents'];
  $paid = (int)$b['paid_cents'];

  $evStmt = $pdo->prepare('SELECT id, slug, title, status, event_status, created_at FROM events WHERE organizer_user_id = ? ORDER BY created_at DESC LIMIT 50');
  $evStmt->execute([$organizerId]);
  $events = [];
  while ($e = $evStmt->fetch()) {
    $events[] = [
      'id' => (string)$e['id'],
      'slug' => (string)$e['slug'],
      'title' => (string)$e['title'],
      'status' => (string)$e['status'],
      'eventStatus' => (string)($e['event_status'] ?? 'approved'),
      'createdAt' => gmdate('c', strtotime($e['created_at'])),
    ];
  }

  $payStmt = $pdo->prepare('SELECT id, total_amount_cents, status, reference, notes, created_at, completed_at FROM payouts WHERE organizer_id = ? ORDER BY created_at DESC LIMIT 20');
  $payStmt->execute([$organizerId]);
  $payouts = [];
  while ($p = $payStmt->fetch()) {
    $payouts[] = [
      'id' => (string)$p['id'],
      'totalAmount' => ((int)$p['total_amount_cents']) / 100,
      'status' => (string)$p['status'],
      'reference' => $p['reference'],
      'notes' => $p['notes'],
      'createdAt' => gmdate('c', strtotime($p['created_at'])),
      'completedAt' => $p['completed_at'] ? gmdate('c', strtotime($p['completed_at'])) : null,
    ];
  }

  json_response(200, [
    'user' => [
      'id' => (string)$user['id'],
      'email' => (string)$user['email'],
      'displayName' => (string)$user['display_name'],
      'status' => (string)$user['status'],
      'createdAt' => gmdate('c', strtotime($user['created_at'])),
    ],
    'profile' => organizer_profile_api_shape($pdo, $organizerId),
    'readiness' => organizer_paid_event_readiness_api_shape($pdo, $organizerId),
    'commission' => organizer_commission_config($pdo, $organizerId),
    'balance' => [
      'grossRevenue' => ((int)$b['gross_cents']) / 100,
      'platformFees' => ((int)$b['fees_cents']) / 100,
      'netEarnings' => $net / 100,
      'paidOut' => $paid / 100,
      'availableBalance' => max(0, $net - $paid) / 100,
    ],
    'events' => $events,
    'payouts' => $payouts,
  ]);
}

if (preg_match('#^/admin/organizers/(\d+)/commission$#', $path, $m) && $method === 'POST') {
  $adminId = require_super_admin_user_id();
  $organizerId = (int)$m[1];
  $pdo = db();
  $exists = $pdo->prepare('SELECT id FROM users WHERE id = ? AND role = ? LIMIT 1');
  $exists->execute([$organizerId, 'organizer']);
  if (!$exists->fetch()) json_response(404, ['error' => 'organizer_not_found']);

  $body = read_json_body();
  $mode = (string)($body['commissionMode'] ?? 'percentage');
  $value = $body['commissionValue'] ?? null;
  $commission = set_organizer_commission_config($pdo, $organizerId, $mode, $value);

  write_log($pdo, $adminId, 'super_admin', 'admin.organizer.commission_updated', 'user', (string)$organizerId, [
    'commissionMode' => $commission['mode'],
    'commissionValue' => $commission['value'],
  ]);

  json_response(200, ['commission' => $commission]);
}

if ($path === '/admin/organizers/balances' && $method === 'GET') {
  require_super_admin_user_id();
  $pdo = db();
  ensure_finance_tables($pdo);
  $stmt = $pdo->query(
    "SELECT
      u.id AS organizer_id,
      u.display_name,
      u.email,
      COALESCE(SUM(CASE WHEN t.payment_status='paid' THEN t.amount_cents ELSE 0 END),0) AS gross_cents,
      COALESCE(SUM(CASE WHEN t.payment_status='paid' THEN t.platform_fee_cents ELSE 0 END),0) AS fees_cents,
      COALESCE(SUM(CASE WHEN t.payment_status='paid' THEN t.organizer_amount_cents ELSE 0 END),0) AS net_cents,
      COALESCE((SELECT SUM(p.total_amount_cents) FROM payouts p WHERE p.organizer_id = u.id AND p.status IN ('processing','completed')),0) AS paid_cents
     FROM users u
     LEFT JOIN events e ON e.organizer_user_id = u.id
     LEFT JOIN transactions t ON t.event_id = e.id
     WHERE u.role = 'organizer'
     GROUP BY u.id, u.display_name, u.email
     ORDER BY net_cents DESC"
  );
  $rows = [];
  while ($r = $stmt->fetch()) {
    $net = (int)$r['net_cents'];
    $paid = (int)$r['paid_cents'];
    $available = max(0, $net - $paid);
    $rows[] = [
      'organizerId' => (string)$r['organizer_id'],
      'displayName' => $r['display_name'],
      'email' => $r['email'],
      'grossRevenue' => ((int)$r['gross_cents']) / 100,
      'platformFees' => ((int)$r['fees_cents']) / 100,
      'netEarnings' => $net / 100,
      'paidOut' => $paid / 100,
      'availableBalance' => $available / 100,
    ];
  }
  json_response(200, ['organizers' => $rows]);
}

if ($path === '/admin/payouts' && $method === 'GET') {
  require_super_admin_user_id();
  $pdo = db();
  ensure_finance_tables($pdo);
  $stmt = $pdo->query(
    'SELECT p.id, p.organizer_id, p.total_amount_cents, p.status, p.method, p.reference, p.notes, p.created_at, p.completed_at, u.display_name
     FROM payouts p
     JOIN users u ON u.id = p.organizer_id
     ORDER BY p.created_at DESC
     LIMIT 300'
  );
  $payouts = [];
  while ($r = $stmt->fetch()) {
    $payouts[] = [
      'id' => (string)$r['id'],
      'organizerId' => (string)$r['organizer_id'],
      'organizerName' => $r['display_name'],
      'totalAmount' => ((int)$r['total_amount_cents']) / 100,
      'status' => $r['status'],
      'method' => $r['method'],
      'reference' => $r['reference'],
      'notes' => $r['notes'],
      'createdAt' => gmdate('c', strtotime($r['created_at'])),
      'completedAt' => $r['completed_at'] ? gmdate('c', strtotime($r['completed_at'])) : null,
    ];
  }
  json_response(200, ['payouts' => $payouts]);
}

if ($path === '/admin/payouts' && $method === 'POST') {
  $adminId = require_super_admin_user_id();
  $pdo = db();
  ensure_finance_tables($pdo);
  $body = read_json_body();
  $organizerId = (int)($body['organizerId'] ?? 0);
  $amount = (float)($body['totalAmount'] ?? 0);
  $notes = trim((string)($body['notes'] ?? ''));
  if ($organizerId <= 0 || $amount <= 0) json_response(400, ['error' => 'invalid_payout']);
  $amountCents = (int)round($amount * 100);

  $balStmt = $pdo->prepare(
    "SELECT
      COALESCE(SUM(CASE WHEN t.payment_status='paid' THEN t.organizer_amount_cents ELSE 0 END),0) AS net_cents,
      COALESCE((SELECT SUM(p.total_amount_cents) FROM payouts p WHERE p.organizer_id = ? AND p.status IN ('processing','completed')),0) AS paid_cents
     FROM events e
     LEFT JOIN transactions t ON t.event_id = e.id
     WHERE e.organizer_user_id = ?"
  );
  $balStmt->execute([$organizerId, $organizerId]);
  $bal = $balStmt->fetch();
  $available = max(0, ((int)($bal['net_cents'] ?? 0)) - ((int)($bal['paid_cents'] ?? 0)));
  if ($amountCents > $available) json_response(400, ['error' => 'insufficient_available_balance']);

  $dupStmt = $pdo->prepare("SELECT id FROM payouts WHERE organizer_id = ? AND total_amount_cents = ? AND status IN ('pending','processing') LIMIT 1");
  $dupStmt->execute([$organizerId, $amountCents]);
  if ($dupStmt->fetch()) json_response(409, ['error' => 'duplicate_pending_payout']);

  $ins = $pdo->prepare('INSERT INTO payouts (organizer_id, total_amount_cents, status, method, notes) VALUES (?, ?, ?, ?, ?)');
  $ins->execute([$organizerId, $amountCents, 'pending', 'bank_transfer', $notes !== '' ? $notes : null]);
  $payoutId = (int)$pdo->lastInsertId();
  $logStmt = $pdo->prepare('INSERT INTO payout_logs (payout_id, admin_user_id, action, note) VALUES (?, ?, ?, ?)');
  $logStmt->execute([$payoutId, $adminId, 'created', $notes !== '' ? $notes : null]);
  write_log($pdo, $adminId, 'super_admin', 'admin.payout.created', 'payout', (string)$payoutId, ['organizerId' => $organizerId, 'amount' => $amount]);
  json_response(201, ['payoutId' => (string)$payoutId]);
}

if (preg_match('#^/admin/payouts/(\\d+)/mark-paid$#', $path, $m) && $method === 'POST') {
  $adminId = require_super_admin_user_id();
  $payoutId = (int)$m[1];
  $body = read_json_body();
  $reference = trim((string)($body['reference'] ?? ''));
  $notes = trim((string)($body['notes'] ?? ''));
  $pdo = db();
  ensure_finance_tables($pdo);
  $stmt = $pdo->prepare('SELECT status FROM payouts WHERE id = ? LIMIT 1');
  $stmt->execute([$payoutId]);
  $row = $stmt->fetch();
  if (!$row) json_response(404, ['error' => 'payout_not_found']);
  if ((string)$row['status'] === 'completed') json_response(400, ['error' => 'already_completed']);

  $upd = $pdo->prepare('UPDATE payouts SET status = ?, reference = ?, notes = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?');
  $upd->execute(['completed', $reference !== '' ? $reference : null, $notes !== '' ? $notes : null, $payoutId]);
  $logStmt = $pdo->prepare('INSERT INTO payout_logs (payout_id, admin_user_id, action, note) VALUES (?, ?, ?, ?)');
  $logStmt->execute([$payoutId, $adminId, 'completed', $notes !== '' ? $notes : null]);
  write_log($pdo, $adminId, 'super_admin', 'admin.payout.completed', 'payout', (string)$payoutId, ['reference' => $reference]);
  json_response(200, ['ok' => true]);
}

if (preg_match('#^/admin/payouts/(\\d+)/status$#', $path, $m) && $method === 'POST') {
  $adminId = require_super_admin_user_id();
  $payoutId = (int)$m[1];
  $body = read_json_body();
  $status = (string)($body['status'] ?? '');
  $reference = trim((string)($body['reference'] ?? ''));
  $note = trim((string)($body['note'] ?? ''));
  if (!in_array($status, ['pending', 'processing', 'completed'], true)) json_response(400, ['error' => 'invalid_status']);
  $upd = db()->prepare('UPDATE payouts SET status = ?, reference = ?, notes = ?, completed_at = CASE WHEN ? = \'completed\' THEN CURRENT_TIMESTAMP ELSE completed_at END WHERE id = ?');
  $upd->execute([$status, $reference !== '' ? $reference : null, $note !== '' ? $note : null, $status, $payoutId]);
  $logStmt = db()->prepare('INSERT INTO payout_logs (payout_id, admin_user_id, action, note) VALUES (?, ?, ?, ?)');
  $logStmt->execute([$payoutId, $adminId, $status, $note !== '' ? $note : null]);
  write_log(db(), $adminId, 'super_admin', 'admin.payout.status_changed', 'payout', (string)$payoutId, ['status' => $status]);
  json_response(200, ['ok' => true]);
}

if ($path === '/admin/payouts/export-csv' && $method === 'GET') {
  require_super_admin_user_id();
  $pdo = db();
  ensure_finance_tables($pdo);
  $stmt = $pdo->query('SELECT p.id, p.organizer_id, u.display_name, p.total_amount_cents, p.status, p.method, p.reference, p.created_at, p.completed_at
     FROM payouts p
     JOIN users u ON u.id = p.organizer_id
     ORDER BY p.created_at DESC');
  $rows = [];
  while ($r = $stmt->fetch()) {
    $rows[] = [
      'id' => (string)$r['id'],
      'organizerId' => (string)$r['organizer_id'],
      'organizerName' => $r['display_name'],
      'amount' => ((int)$r['total_amount_cents']) / 100,
      'status' => $r['status'],
      'method' => $r['method'],
      'reference' => $r['reference'] ?? '',
      'createdAt' => $r['created_at'],
      'completedAt' => $r['completed_at'] ?? '',
    ];
  }
  json_response(200, ['rows' => $rows]);
}

if ($path === '/admin/payhere/check' && $method === 'GET') {
  require_super_admin_user_id();
  json_response(200, payhere_sandbox_probe(payhere_cfg()));
}

if ($path === '/admin/settings' && $method === 'GET') {
  require_super_admin_user_id();
  $pdo = db();
  ensure_finance_tables($pdo);
  $rows = $pdo->query('SELECT setting_key, setting_value FROM global_settings')->fetchAll();
  $settings = [];
  foreach ($rows ?: [] as $row) $settings[(string)$row['setting_key']] = $row['setting_value'];
  $settings['commission_pct'] = (string)get_platform_commission_pct($pdo);
  json_response(200, ['settings' => $settings]);
}

if ($path === '/admin/settings' && $method === 'POST') {
  $adminId = require_super_admin_user_id();
  $pdo = db();
  ensure_finance_tables($pdo);
  $body = read_json_body();
  $allowed = ['platform_name', 'platform_logo_url', 'commission_pct', 'email_from', 'maintenance_mode'];
  foreach ($allowed as $key) {
    if (!array_key_exists($key, $body)) continue;
    $value = (string)$body[$key];
    $stmt = $pdo->prepare('INSERT INTO global_settings (setting_key, setting_value) VALUES (?, ?) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value');
    try {
      $stmt->execute([$key, $value]);
    } catch (Throwable $e) {
      $stmt2 = $pdo->prepare('INSERT INTO global_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)');
      $stmt2->execute([$key, $value]);
    }
    if ($key === 'commission_pct') {
      $c = max(0, min(100, (float)$value));
      $stmt3 = $pdo->prepare('INSERT INTO admin_settings (setting_key, setting_value) VALUES (?, ?) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value');
      try {
        $stmt3->execute(['commission_pct', (string)$c]);
      } catch (Throwable $e) {
        $stmt4 = $pdo->prepare('INSERT INTO admin_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)');
        $stmt4->execute(['commission_pct', (string)$c]);
      }
    }
  }
  write_log($pdo, $adminId, 'super_admin', 'admin.settings.updated', 'setting', null, ['keys' => array_keys($body)]);
  json_response(200, ['ok' => true]);
}

if ($path === '/admin/system/cleanup-demo-data' && $method === 'POST') {
  $adminId = require_super_admin_user_id();
  $pdo = db();
  $demoEmails = ['demo@turnout.local', 'superadmin@turnout.local'];
  $deletedUsers = 0;
  $deletedEvents = 0;
  foreach ($demoEmails as $email) {
    $eventStmt = $pdo->prepare("SELECT COUNT(*) AS c FROM events WHERE organizer_user_id IN (SELECT id FROM users WHERE email = ?)");
    $eventStmt->execute([$email]);
    $deletedEvents += (int)(($eventStmt->fetch())['c'] ?? 0);
    $delStmt = $pdo->prepare('DELETE FROM users WHERE email = ?');
    $delStmt->execute([$email]);
    $deletedUsers += $delStmt->rowCount();
  }
  write_log($pdo, $adminId, 'super_admin', 'admin.system.cleanup_demo_data', 'system', null, ['deletedUsers' => $deletedUsers, 'deletedEvents' => $deletedEvents]);
  json_response(200, ['ok' => true, 'deletedUsers' => $deletedUsers, 'deletedEvents' => $deletedEvents]);
}

if ($path === '/admin/settings/commission' && $method === 'GET') {
  require_super_admin_user_id();
  $pdo = db();
  $pct = get_platform_commission_pct($pdo);
  json_response(200, ['commissionPct' => $pct]);
}

if ($path === '/admin/settings/commission' && $method === 'POST') {
  require_super_admin_user_id();
  $body = read_json_body();
  $pct = (float)($body['commissionPct'] ?? -1);
  if ($pct < 0 || $pct > 100) json_response(400, ['error' => 'invalid_commission_pct']);
  $pdo = db();
  ensure_finance_tables($pdo);
  $stmt = $pdo->prepare('INSERT INTO admin_settings (setting_key, setting_value) VALUES (?, ?)
    ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value');
  try {
    $stmt->execute(['commission_pct', (string)$pct]);
  } catch (Throwable $e) {
    $stmt2 = $pdo->prepare('INSERT INTO admin_settings (setting_key, setting_value) VALUES (?, ?)
      ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)');
    $stmt2->execute(['commission_pct', (string)$pct]);
  }
  json_response(200, ['commissionPct' => $pct]);
}

if ($path === '/admin/logs' && $method === 'GET') {
  require_super_admin_user_id();
  $action = trim((string)($_GET['action'] ?? ''));
  $sql = 'SELECT id, actor_user_id, actor_role, action, target_type, target_id, details_json, ip_address, created_at FROM logs WHERE 1=1';
  $params = [];
  if ($action !== '') {
    $sql .= ' AND action = ?';
    $params[] = $action;
  }
  $sql .= ' ORDER BY created_at DESC LIMIT 500';
  $stmt = db()->prepare($sql);
  $stmt->execute($params);
  $logs = [];
  while ($row = $stmt->fetch()) {
    $logs[] = [
      'id' => (string)$row['id'],
      'actorUserId' => $row['actor_user_id'] ? (string)$row['actor_user_id'] : null,
      'actorRole' => $row['actor_role'],
      'action' => $row['action'],
      'targetType' => $row['target_type'],
      'targetId' => $row['target_id'],
      'details' => $row['details_json'] ? json_decode((string)$row['details_json'], true) : null,
      'ipAddress' => $row['ip_address'],
      'createdAt' => gmdate('c', strtotime($row['created_at'])),
    ];
  }
  json_response(200, ['logs' => $logs]);
}

if ($path === '/admin/dashboard' && $method === 'GET') {
  require_super_admin_user_id();
  json_response(200, ['ok' => true]);
}

if ($path === '/admin/events/override' && $method === 'POST') {
  $adminId = require_super_admin_user_id();
  $body = read_json_body();
  $eventId = (int)($body['eventId'] ?? 0);
  if ($eventId <= 0) json_response(400, ['error' => 'invalid_event']);
  $fields = ['title', 'description', 'location', 'banner_url', 'status'];
  $set = [];
  $params = [];
  foreach ($fields as $field) {
    if (!array_key_exists($field, $body)) continue;
    $set[] = $field . ' = ?';
    $params[] = (string)$body[$field];
  }
  if (!$set) json_response(400, ['error' => 'no_changes']);
  $params[] = $eventId;
  $upd = db()->prepare('UPDATE events SET ' . implode(', ', $set) . ' WHERE id = ?');
  $upd->execute($params);
  write_log(db(), $adminId, 'super_admin', 'admin.event.overridden', 'event', (string)$eventId, ['fields' => array_keys($body)]);
  json_response(200, ['ok' => true]);
}

if ($path === '/organizer/earnings' && $method === 'GET') {
  $uid = require_organizer_user_id();
  $pdo = db();
  ensure_finance_tables($pdo);

  $sumStmt = $pdo->prepare(
    "SELECT
      COALESCE(SUM(CASE WHEN t.payment_status='paid' THEN t.amount_cents ELSE 0 END),0) AS gross_cents,
      COALESCE(SUM(CASE WHEN t.payment_status='paid' THEN t.platform_fee_cents ELSE 0 END),0) AS fee_cents,
      COALESCE(SUM(CASE WHEN t.payment_status='paid' THEN t.organizer_amount_cents ELSE 0 END),0) AS net_cents
     FROM events e
     LEFT JOIN transactions t ON t.event_id = e.id
     WHERE e.organizer_user_id = ?"
  );
  $sumStmt->execute([$uid]);
  $sum = $sumStmt->fetch();

  $payoutStmt = $pdo->prepare(
    "SELECT id, organizer_id, total_amount_cents, status, method, reference, notes, created_at, completed_at
     FROM payouts
     WHERE organizer_id = ?
     ORDER BY created_at DESC
     LIMIT 100"
  );
  $payoutStmt->execute([$uid]);
  $payouts = [];
  $paidOutCents = 0;
  while ($r = $payoutStmt->fetch()) {
    if (in_array((string)$r['status'], ['processing', 'completed'], true)) $paidOutCents += (int)$r['total_amount_cents'];
    $payouts[] = [
      'id' => (string)$r['id'],
      'organizerId' => (string)$r['organizer_id'],
      'totalAmount' => ((int)$r['total_amount_cents']) / 100,
      'status' => $r['status'],
      'method' => $r['method'],
      'reference' => $r['reference'],
      'notes' => $r['notes'],
      'createdAt' => gmdate('c', strtotime($r['created_at'])),
      'completedAt' => $r['completed_at'] ? gmdate('c', strtotime($r['completed_at'])) : null,
    ];
  }

  $grossCents = (int)($sum['gross_cents'] ?? 0);
  $feeCents = (int)($sum['fee_cents'] ?? 0);
  $netCents = (int)($sum['net_cents'] ?? 0);
  $availableCents = max(0, $netCents - $paidOutCents);

  json_response(200, [
    'earnings' => [
      'grossRevenue' => $grossCents / 100,
      'platformFees' => $feeCents / 100,
      'netEarnings' => $netCents / 100,
      'paidOut' => $paidOutCents / 100,
      'availableBalance' => $availableCents / 100,
      'payoutHistory' => $payouts,
    ],
  ]);
}

json_response(404, ['error' => 'not_found']);

