<?php

/**
 * Event coupon codes — percent or fixed discount on order subtotal (after ticket pricing).
 */

function ensure_event_coupons_table(PDO $pdo): void {
  static $checked = false;
  if ($checked) return;
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);

  if ($driver === 'sqlite') {
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS event_coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        code TEXT NOT NULL,
        discount_type TEXT NOT NULL,
        discount_value_cents INTEGER NOT NULL DEFAULT 0,
        discount_percent REAL NOT NULL DEFAULT 0,
        max_uses INTEGER NULL,
        used_count INTEGER NOT NULL DEFAULT 0,
        min_order_cents INTEGER NULL,
        starts_at TEXT NULL,
        ends_at TEXT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id, code)
      )'
    );
  } elseif ($driver === 'pgsql') {
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS event_coupons (
        id BIGSERIAL PRIMARY KEY,
        event_id BIGINT NOT NULL,
        code VARCHAR(64) NOT NULL,
        discount_type VARCHAR(16) NOT NULL,
        discount_value_cents INT NOT NULL DEFAULT 0,
        discount_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
        max_uses INT NULL,
        used_count INT NOT NULL DEFAULT 0,
        min_order_cents INT NULL,
        starts_at TIMESTAMP NULL,
        ends_at TIMESTAMP NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id, code)
      )'
    );
  } else {
    $pdo->exec(
      "CREATE TABLE IF NOT EXISTS event_coupons (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        event_id BIGINT UNSIGNED NOT NULL,
        code VARCHAR(64) NOT NULL,
        discount_type VARCHAR(16) NOT NULL,
        discount_value_cents INT NOT NULL DEFAULT 0,
        discount_percent DECIMAL(8,2) NOT NULL DEFAULT 0,
        max_uses INT NULL,
        used_count INT NOT NULL DEFAULT 0,
        min_order_cents INT NULL,
        starts_at DATETIME NULL,
        ends_at DATETIME NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_event_coupon_code (event_id, code),
        KEY idx_event_coupons_event (event_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
  }
  $checked = true;
}

function ensure_order_coupon_columns(PDO $pdo): void {
  static $checked = false;
  if ($checked) return;
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  $cols = [
    'coupon_id' => $driver === 'pgsql' ? 'BIGINT NULL' : ($driver === 'sqlite' ? 'INTEGER NULL' : 'BIGINT UNSIGNED NULL'),
    'coupon_code' => $driver === 'pgsql' ? 'VARCHAR(64) NULL' : ($driver === 'sqlite' ? 'TEXT NULL' : 'VARCHAR(64) NULL'),
    'discount_amount_cents' => $driver === 'pgsql' ? 'INT NOT NULL DEFAULT 0' : ($driver === 'sqlite' ? 'INTEGER NOT NULL DEFAULT 0' : 'INT NOT NULL DEFAULT 0'),
  ];
  foreach ($cols as $name => $type) {
    try {
      if ($driver === 'pgsql') {
        $pdo->exec("ALTER TABLE orders ADD COLUMN IF NOT EXISTS {$name} {$type}");
      } else {
        $pdo->exec("ALTER TABLE orders ADD COLUMN {$name} {$type}");
      }
    } catch (Throwable $e) {
      // Column may already exist.
    }
  }
  $checked = true;
}

function normalize_coupon_code(string $code): string {
  $code = strtoupper(trim($code));
  $code = preg_replace('/\s+/', '', $code) ?? $code;
  return $code;
}

function coupon_api_shape(array $row): array {
  $type = strtolower(trim((string)($row['discount_type'] ?? 'percent')));
  $active = !empty($row['active']);
  if ($row['active'] === '0' || $row['active'] === 0 || $row['active'] === false) {
    $active = false;
  }
  return [
    'id' => (string)$row['id'],
    'eventId' => (string)$row['event_id'],
    'code' => (string)$row['code'],
    'discountType' => $type === 'fixed' ? 'fixed' : 'percent',
    'discountPercent' => (float)($row['discount_percent'] ?? 0),
    'discountValue' => ((int)($row['discount_value_cents'] ?? 0)) / 100,
    'maxUses' => isset($row['max_uses']) && $row['max_uses'] !== null && $row['max_uses'] !== ''
      ? (int)$row['max_uses']
      : null,
    'usedCount' => (int)($row['used_count'] ?? 0),
    'minOrderAmount' => isset($row['min_order_cents']) && $row['min_order_cents'] !== null && $row['min_order_cents'] !== ''
      ? ((int)$row['min_order_cents']) / 100
      : null,
    'startsAt' => !empty($row['starts_at']) ? gmdate('c', strtotime((string)$row['starts_at'])) : null,
    'endsAt' => !empty($row['ends_at']) ? gmdate('c', strtotime((string)$row['ends_at'])) : null,
    'active' => $active,
    'createdAt' => !empty($row['created_at']) ? gmdate('c', strtotime((string)$row['created_at'])) : null,
  ];
}

function parse_optional_datetime_input(mixed $raw): ?string {
  if ($raw === null || $raw === '') return null;
  $s = trim((string)$raw);
  if ($s === '') return null;
  $ts = strtotime($s);
  if ($ts === false) {
    json_response(400, ['error' => 'invalid_datetime', 'message' => 'Enter a valid date/time.']);
  }
  return gmdate('Y-m-d H:i:s', $ts);
}

function compute_coupon_discount_cents(int $subtotalCents, array $coupon): int {
  if ($subtotalCents <= 0) return 0;
  $type = strtolower(trim((string)($coupon['discount_type'] ?? 'percent')));
  if ($type === 'fixed') {
    $discount = (int)($coupon['discount_value_cents'] ?? 0);
  } else {
    $pct = (float)($coupon['discount_percent'] ?? 0);
    if ($pct <= 0) return 0;
    $discount = (int)round($subtotalCents * ($pct / 100.0));
  }
  if ($discount < 0) $discount = 0;
  if ($discount > $subtotalCents) $discount = $subtotalCents;
  return $discount;
}

/**
 * Load and validate a coupon for checkout. Returns coupon row or errors via json_response.
 */
function load_valid_coupon_for_checkout(PDO $pdo, int $eventId, string $code, int $subtotalCents): array {
  ensure_event_coupons_table($pdo);
  $code = normalize_coupon_code($code);
  if ($code === '' || strlen($code) > 64) {
    json_response(400, ['error' => 'invalid_coupon_code', 'message' => 'Enter a valid coupon code.']);
  }

  $stmt = $pdo->prepare('SELECT * FROM event_coupons WHERE event_id = ? AND code = ? LIMIT 1');
  $stmt->execute([$eventId, $code]);
  $row = $stmt->fetch();
  if (!$row) {
    json_response(404, ['error' => 'coupon_not_found', 'message' => 'That coupon code was not found.']);
  }

  $active = !empty($row['active']);
  if ($row['active'] === '0' || $row['active'] === 0 || $row['active'] === false) {
    $active = false;
  }
  if (!$active) {
    json_response(400, ['error' => 'coupon_inactive', 'message' => 'This coupon is no longer active.']);
  }

  $now = time();
  if (!empty($row['starts_at'])) {
    $startTs = strtotime((string)$row['starts_at']);
    if ($startTs !== false && $now < $startTs) {
      json_response(400, ['error' => 'coupon_not_started', 'message' => 'This coupon is not active yet.']);
    }
  }
  if (!empty($row['ends_at'])) {
    $endTs = strtotime((string)$row['ends_at']);
    if ($endTs !== false && $now > $endTs) {
      json_response(400, ['error' => 'coupon_expired', 'message' => 'This coupon has expired.']);
    }
  }

  $maxUses = $row['max_uses'] !== null && $row['max_uses'] !== '' ? (int)$row['max_uses'] : null;
  $used = (int)($row['used_count'] ?? 0);
  if ($maxUses !== null && $maxUses > 0 && $used >= $maxUses) {
    json_response(400, ['error' => 'coupon_exhausted', 'message' => 'This coupon has reached its usage limit.']);
  }

  $minOrder = $row['min_order_cents'] !== null && $row['min_order_cents'] !== ''
    ? (int)$row['min_order_cents']
    : null;
  if ($minOrder !== null && $minOrder > 0 && $subtotalCents < $minOrder) {
    json_response(400, [
      'error' => 'coupon_min_order',
      'message' => 'Order total is below the minimum for this coupon (LKR ' . number_format($minOrder / 100, 2) . ').',
    ]);
  }

  return $row;
}

/**
 * @return array{subtotalCents:int,discountCents:int,totalCents:int,coupon:?array}
 */
function apply_coupon_code_to_subtotal(PDO $pdo, int $eventId, int $subtotalCents, ?string $couponCode): array {
  $code = normalize_coupon_code((string)($couponCode ?? ''));
  if ($code === '') {
    return [
      'subtotalCents' => $subtotalCents,
      'discountCents' => 0,
      'totalCents' => $subtotalCents,
      'coupon' => null,
    ];
  }

  $coupon = load_valid_coupon_for_checkout($pdo, $eventId, $code, $subtotalCents);
  $discount = compute_coupon_discount_cents($subtotalCents, $coupon);
  return [
    'subtotalCents' => $subtotalCents,
    'discountCents' => $discount,
    'totalCents' => max(0, $subtotalCents - $discount),
    'coupon' => $coupon,
  ];
}

function attach_coupon_to_order(PDO $pdo, int $orderId, ?array $coupon, int $discountCents): void {
  ensure_order_coupon_columns($pdo);
  if (!$coupon) {
    $stmt = $pdo->prepare('UPDATE orders SET coupon_id = NULL, coupon_code = NULL, discount_amount_cents = 0 WHERE id = ?');
    $stmt->execute([$orderId]);
    return;
  }
  $stmt = $pdo->prepare(
    'UPDATE orders SET coupon_id = ?, coupon_code = ?, discount_amount_cents = ? WHERE id = ?'
  );
  $stmt->execute([
    (int)$coupon['id'],
    (string)$coupon['code'],
    max(0, $discountCents),
    $orderId,
  ]);
}

function increment_coupon_used_count(PDO $pdo, int $couponId): void {
  if ($couponId <= 0) return;
  $stmt = $pdo->prepare('UPDATE event_coupons SET used_count = used_count + 1 WHERE id = ?');
  $stmt->execute([$couponId]);
}
