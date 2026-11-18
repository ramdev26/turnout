<?php

/**
 * Event tracked links — attribution codes for artists / ads (no discount).
 * Capture via ?ref=CODE (or ?via=) on the landing page; attach to checkout orders.
 */

function ensure_event_tracked_links_table(PDO $pdo): void {
  static $checked = false;
  if ($checked) return;
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);

  if ($driver === 'sqlite') {
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS event_tracked_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        code TEXT NOT NULL,
        label TEXT NOT NULL DEFAULT \'\',
        click_count INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id, code)
      )'
    );
  } elseif ($driver === 'pgsql') {
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS event_tracked_links (
        id BIGSERIAL PRIMARY KEY,
        event_id BIGINT NOT NULL,
        code VARCHAR(64) NOT NULL,
        label VARCHAR(160) NOT NULL DEFAULT \'\',
        click_count INT NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id, code)
      )'
    );
  } else {
    $pdo->exec(
      "CREATE TABLE IF NOT EXISTS event_tracked_links (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        event_id BIGINT UNSIGNED NOT NULL,
        code VARCHAR(64) NOT NULL,
        label VARCHAR(160) NOT NULL DEFAULT '',
        click_count INT NOT NULL DEFAULT 0,
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_event_tracked_link_code (event_id, code),
        KEY idx_event_tracked_links_event (event_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
  }
  $checked = true;
}

function ensure_order_tracked_link_columns(PDO $pdo): void {
  static $checked = false;
  if ($checked) return;
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  $cols = [
    'tracked_link_id' => $driver === 'pgsql' ? 'BIGINT NULL' : ($driver === 'sqlite' ? 'INTEGER NULL' : 'BIGINT UNSIGNED NULL'),
    'tracked_link_code' => $driver === 'pgsql' ? 'VARCHAR(64) NULL' : ($driver === 'sqlite' ? 'TEXT NULL' : 'VARCHAR(64) NULL'),
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

function normalize_tracked_link_code(string $code): string {
  $code = strtoupper(trim($code));
  $code = preg_replace('/\s+/', '', $code) ?? $code;
  return $code;
}

function tracked_link_api_shape(array $row, array $stats = []): array {
  $active = !empty($row['active']);
  if ($row['active'] === '0' || $row['active'] === 0 || $row['active'] === false) {
    $active = false;
  }
  return [
    'id' => (string)$row['id'],
    'eventId' => (string)$row['event_id'],
    'code' => (string)$row['code'],
    'label' => (string)($row['label'] ?? ''),
    'clickCount' => (int)($row['click_count'] ?? 0),
    'orderCount' => (int)($stats['orderCount'] ?? 0),
    'ticketCount' => (int)($stats['ticketCount'] ?? 0),
    'revenue' => ((int)($stats['revenueCents'] ?? 0)) / 100,
    'active' => $active,
    'createdAt' => isset($row['created_at']) ? (string)$row['created_at'] : null,
  ];
}

/**
 * Paid-order stats keyed by tracked_link_id for one event.
 *
 * @return array<int, array{orderCount:int,ticketCount:int,revenueCents:int}>
 */
function tracked_link_sales_stats_by_id(PDO $pdo, int $eventId): array {
  ensure_order_tracked_link_columns($pdo);
  $stmt = $pdo->prepare(
    "SELECT tracked_link_id,
            COUNT(*) AS order_count,
            COALESCE(SUM(total_amount_cents), 0) AS revenue_cents
     FROM orders
     WHERE event_id = ?
       AND tracked_link_id IS NOT NULL
       AND status = 'paid'
     GROUP BY tracked_link_id"
  );
  $stmt->execute([$eventId]);
  $out = [];
  while ($row = $stmt->fetch()) {
    $id = (int)$row['tracked_link_id'];
    $out[$id] = [
      'orderCount' => (int)$row['order_count'],
      'ticketCount' => 0,
      'revenueCents' => (int)$row['revenue_cents'],
    ];
  }

  // Ticket counts from tickets_json (quantity sum) for paid attributed orders.
  $detail = $pdo->prepare(
    "SELECT tracked_link_id, tickets_json
     FROM orders
     WHERE event_id = ?
       AND tracked_link_id IS NOT NULL
       AND status = 'paid'"
  );
  $detail->execute([$eventId]);
  while ($row = $detail->fetch()) {
    $id = (int)$row['tracked_link_id'];
    if (!isset($out[$id])) {
      $out[$id] = ['orderCount' => 0, 'ticketCount' => 0, 'revenueCents' => 0];
    }
    $items = json_decode((string)($row['tickets_json'] ?? '[]'), true);
    if (!is_array($items)) continue;
    foreach ($items as $item) {
      if (!is_array($item)) continue;
      $out[$id]['ticketCount'] += max(0, (int)($item['quantity'] ?? 0));
    }
  }

  return $out;
}

function load_active_tracked_link(PDO $pdo, int $eventId, string $code): ?array {
  ensure_event_tracked_links_table($pdo);
  $code = normalize_tracked_link_code($code);
  if ($code === '') return null;
  $stmt = $pdo->prepare(
    'SELECT * FROM event_tracked_links WHERE event_id = ? AND code = ? LIMIT 1'
  );
  $stmt->execute([$eventId, $code]);
  $row = $stmt->fetch();
  if (!$row) return null;
  $active = !empty($row['active']);
  if ($row['active'] === '0' || $row['active'] === 0 || $row['active'] === false) {
    $active = false;
  }
  if (!$active) return null;
  return $row;
}

function attach_tracked_link_to_order(PDO $pdo, int $orderId, ?array $link): void {
  ensure_order_tracked_link_columns($pdo);
  if (!$link) {
    $stmt = $pdo->prepare('UPDATE orders SET tracked_link_id = NULL, tracked_link_code = NULL WHERE id = ?');
    $stmt->execute([$orderId]);
    return;
  }
  $stmt = $pdo->prepare('UPDATE orders SET tracked_link_id = ?, tracked_link_code = ? WHERE id = ?');
  $stmt->execute([(int)$link['id'], (string)$link['code'], $orderId]);
}

function increment_tracked_link_click_count(PDO $pdo, int $linkId): void {
  if ($linkId <= 0) return;
  $stmt = $pdo->prepare('UPDATE event_tracked_links SET click_count = click_count + 1 WHERE id = ?');
  $stmt->execute([$linkId]);
}

/**
 * Resolve optional trackedLinkCode from a checkout body and attach to the order.
 * Invalid / inactive codes are ignored (do not fail checkout).
 */
function attach_tracked_link_code_from_body(PDO $pdo, int $eventId, int $orderId, array $body): ?array {
  $raw = (string)($body['trackedLinkCode'] ?? $body['ref'] ?? $body['via'] ?? '');
  $code = normalize_tracked_link_code($raw);
  if ($code === '') return null;
  $link = load_active_tracked_link($pdo, $eventId, $code);
  if (!$link) return null;
  attach_tracked_link_to_order($pdo, $orderId, $link);
  return $link;
}
