<?php

/**
 * Per-event public page visit analytics for organizers.
 */

function ensure_event_analytics_tables(PDO $pdo): void {
  static $checked = false;
  if ($checked) return;
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);

  if ($driver === 'sqlite') {
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS event_page_visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        visitor_key TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT \'Direct\',
        referrer TEXT NULL,
        referrer_host TEXT NULL,
        utm_source TEXT NULL,
        utm_medium TEXT NULL,
        utm_campaign TEXT NULL,
        path TEXT NULL,
        user_agent TEXT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )'
    );
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_epv_event_created ON event_page_visits(event_id, created_at)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_epv_event_visitor ON event_page_visits(event_id, visitor_key)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_epv_event_source ON event_page_visits(event_id, source)');
  } elseif ($driver === 'pgsql') {
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS event_page_visits (
        id BIGSERIAL PRIMARY KEY,
        event_id BIGINT NOT NULL,
        visitor_key VARCHAR(64) NOT NULL,
        source VARCHAR(120) NOT NULL DEFAULT \'Direct\',
        referrer TEXT NULL,
        referrer_host VARCHAR(255) NULL,
        utm_source VARCHAR(120) NULL,
        utm_medium VARCHAR(120) NULL,
        utm_campaign VARCHAR(160) NULL,
        path VARCHAR(255) NULL,
        user_agent VARCHAR(255) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )'
    );
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_epv_event_created ON event_page_visits(event_id, created_at DESC)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_epv_event_visitor ON event_page_visits(event_id, visitor_key)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_epv_event_source ON event_page_visits(event_id, source)');
  } else {
    $pdo->exec(
      "CREATE TABLE IF NOT EXISTS event_page_visits (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        event_id BIGINT UNSIGNED NOT NULL,
        visitor_key VARCHAR(64) NOT NULL,
        source VARCHAR(120) NOT NULL DEFAULT 'Direct',
        referrer TEXT NULL,
        referrer_host VARCHAR(255) NULL,
        utm_source VARCHAR(120) NULL,
        utm_medium VARCHAR(120) NULL,
        utm_campaign VARCHAR(160) NULL,
        path VARCHAR(255) NULL,
        user_agent VARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_epv_event_created (event_id, created_at),
        KEY idx_epv_event_visitor (event_id, visitor_key),
        KEY idx_epv_event_source (event_id, source)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
  }
  $checked = true;
}

function event_analytics_days(?int $requested = null): int {
  $days = $requested ?? (int)($_GET['days'] ?? 30);
  return max(7, min(90, $days));
}

function sanitize_analytics_token(?string $value, int $maxLen = 120): ?string {
  $v = trim((string)$value);
  if ($v === '') return null;
  $v = preg_replace('/[\x00-\x1F\x7F]/', '', $v) ?? '';
  $v = trim($v);
  if ($v === '') return null;
  if (function_exists('mb_substr')) {
    return mb_substr($v, 0, $maxLen);
  }
  return substr($v, 0, $maxLen);
}

function sanitize_visitor_key(?string $value): string {
  $v = strtolower(trim((string)$value));
  $v = preg_replace('/[^a-z0-9\-_]/', '', $v) ?? '';
  if ($v === '' || strlen($v) < 8) {
    return bin2hex(random_bytes(16));
  }
  return substr($v, 0, 64);
}

function parse_referrer_host(?string $referrer): ?string {
  $ref = trim((string)$referrer);
  if ($ref === '') return null;
  $host = parse_url($ref, PHP_URL_HOST);
  if (!is_string($host) || $host === '') return null;
  $host = strtolower($host);
  if (str_starts_with($host, 'www.')) {
    $host = substr($host, 4);
  }
  return sanitize_analytics_token($host, 255);
}

function resolve_visit_source(?string $utmSource, ?string $referrerHost): string {
  $utm = sanitize_analytics_token($utmSource, 120);
  if ($utm !== null) return $utm;
  if ($referrerHost !== null && $referrerHost !== '') return $referrerHost;
  return 'Direct';
}

function event_analytics_client_ip(): string {
  $candidates = [
    (string)($_SERVER['HTTP_CF_CONNECTING_IP'] ?? ''),
    (string)($_SERVER['HTTP_X_FORWARDED_FOR'] ?? ''),
    (string)($_SERVER['REMOTE_ADDR'] ?? ''),
  ];
  foreach ($candidates as $raw) {
    $raw = trim($raw);
    if ($raw === '') continue;
    $first = trim(explode(',', $raw)[0]);
    if (filter_var($first, FILTER_VALIDATE_IP)) {
      return $first;
    }
  }
  return '0.0.0.0';
}

function event_visit_recently_recorded(PDO $pdo, int $eventId, string $visitorKey, int $seconds = 45): bool {
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  $seconds = max(1, min(600, $seconds));
  if ($driver === 'sqlite') {
    $stmt = $pdo->prepare(
      "SELECT 1 FROM event_page_visits
       WHERE event_id = ? AND visitor_key = ?
         AND created_at >= datetime('now', '-{$seconds} seconds')
       LIMIT 1"
    );
    $stmt->execute([$eventId, $visitorKey]);
  } elseif ($driver === 'pgsql') {
    $stmt = $pdo->prepare(
      "SELECT 1 FROM event_page_visits
       WHERE event_id = ? AND visitor_key = ?
         AND created_at >= NOW() - INTERVAL '{$seconds} seconds'
       LIMIT 1"
    );
    $stmt->execute([$eventId, $visitorKey]);
  } else {
    $stmt = $pdo->prepare(
      "SELECT 1 FROM event_page_visits
       WHERE event_id = ? AND visitor_key = ?
         AND created_at >= (NOW() - INTERVAL {$seconds} SECOND)
       LIMIT 1"
    );
    $stmt->execute([$eventId, $visitorKey]);
  }
  return (bool)$stmt->fetchColumn();
}

function record_event_page_visit(PDO $pdo, int $eventId, array $payload): array {
  ensure_event_analytics_tables($pdo);

  $stmt = $pdo->prepare('SELECT id, status, organizer_user_id FROM events WHERE id = ? LIMIT 1');
  $stmt->execute([$eventId]);
  $event = $stmt->fetch();
  if (!$event) {
    return ['ok' => false, 'error' => 'event_not_found', 'status' => 404];
  }
  if ((string)($event['status'] ?? '') !== 'published') {
    return ['ok' => true, 'recorded' => false, 'reason' => 'not_published'];
  }

  $uid = current_user_id();
  if ($uid !== null) {
    $user = load_user_profile($uid);
    if (($user['role'] ?? '') === 'organizer' && user_can_access_event_row($pdo, $event, $uid, 'viewer')) {
      return ['ok' => true, 'recorded' => false, 'reason' => 'organizer_preview'];
    }
  }

  $visitorKey = sanitize_visitor_key((string)($payload['visitorKey'] ?? ''));
  if (event_visit_recently_recorded($pdo, $eventId, $visitorKey, 45)) {
    return ['ok' => true, 'recorded' => false, 'reason' => 'deduped'];
  }

  $utmSource = sanitize_analytics_token($payload['utmSource'] ?? null, 120);
  $utmMedium = sanitize_analytics_token($payload['utmMedium'] ?? null, 120);
  $utmCampaign = sanitize_analytics_token($payload['utmCampaign'] ?? null, 160);
  $referrer = sanitize_analytics_token($payload['referrer'] ?? null, 500);
  $referrerHost = parse_referrer_host($referrer);
  // Prefer client-provided host only when referrer parse failed.
  if ($referrerHost === null) {
    $referrerHost = sanitize_analytics_token($payload['referrerHost'] ?? null, 255);
  }
  $source = resolve_visit_source($utmSource, $referrerHost);
  $path = sanitize_analytics_token($payload['path'] ?? null, 255);
  $ua = sanitize_analytics_token($_SERVER['HTTP_USER_AGENT'] ?? ($payload['userAgent'] ?? null), 255);

  $ins = $pdo->prepare(
    'INSERT INTO event_page_visits
      (event_id, visitor_key, source, referrer, referrer_host, utm_source, utm_medium, utm_campaign, path, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  $ins->execute([
    $eventId,
    $visitorKey,
    $source,
    $referrer,
    $referrerHost,
    $utmSource,
    $utmMedium,
    $utmCampaign,
    $path,
    $ua,
  ]);

  return ['ok' => true, 'recorded' => true, 'source' => $source];
}

function event_analytics_fill_day_series(array $rows, int $days): array {
  $map = [];
  foreach ($rows as $row) {
    if (!is_array($row)) continue;
    $day = (string)($row['day'] ?? '');
    if ($day === '') continue;
    $map[$day] = $row;
  }

  $series = [];
  $today = new DateTimeImmutable('today');
  for ($i = $days - 1; $i >= 0; $i--) {
    $date = $today->sub(new DateInterval('P' . $i . 'D'))->format('Y-m-d');
    $hit = $map[$date] ?? null;
    $series[] = [
      'date' => $date,
      'visits' => is_array($hit) ? (int)($hit['visits'] ?? 0) : 0,
      'uniqueVisitors' => is_array($hit) ? (int)($hit['uniqueVisitors'] ?? 0) : 0,
    ];
  }
  return $series;
}

function event_analytics_day_expr(string $driver, string $column = 'created_at'): string {
  if ($driver === 'sqlite') {
    return "date({$column})";
  }
  return "DATE({$column})";
}

function event_analytics_since_sql(string $driver, int $days, string $column = 'created_at'): string {
  $span = max(0, $days - 1);
  if ($driver === 'sqlite') {
    return "{$column} >= datetime('now', '-{$span} days')";
  }
  if ($driver === 'pgsql') {
    return "{$column} >= CURRENT_DATE - INTERVAL '{$span} days'";
  }
  return "{$column} >= DATE_SUB(CURDATE(), INTERVAL {$span} DAY)";
}

function event_analytics_visits_by_day(PDO $pdo, int $eventId, int $days): array {
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  $dayExpr = event_analytics_day_expr($driver);
  $sinceSql = event_analytics_since_sql($driver, $days);

  $sql = "SELECT {$dayExpr} AS day,
                 COUNT(*) AS visits,
                 COUNT(DISTINCT visitor_key) AS unique_visitors
          FROM event_page_visits
          WHERE event_id = ? AND {$sinceSql}
          GROUP BY {$dayExpr}
          ORDER BY day ASC";
  $stmt = $pdo->prepare($sql);
  $stmt->execute([$eventId]);

  $rows = [];
  while ($row = $stmt->fetch()) {
    $rows[] = [
      'day' => (string)$row['day'],
      'visits' => (int)($row['visits'] ?? 0),
      'uniqueVisitors' => (int)($row['unique_visitors'] ?? 0),
    ];
  }
  return event_analytics_fill_day_series($rows, $days);
}

function event_analytics_sources(PDO $pdo, int $eventId, int $days, int $limit = 12): array {
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  $sinceSql = event_analytics_since_sql($driver, $days);
  $limit = max(1, min(30, $limit));

  $sql = "SELECT source,
                 COUNT(*) AS visits,
                 COUNT(DISTINCT visitor_key) AS unique_visitors
          FROM event_page_visits
          WHERE event_id = ? AND {$sinceSql}
          GROUP BY source
          ORDER BY visits DESC
          LIMIT {$limit}";
  $stmt = $pdo->prepare($sql);
  $stmt->execute([$eventId]);

  $out = [];
  while ($row = $stmt->fetch()) {
    $out[] = [
      'source' => (string)($row['source'] ?? 'Direct'),
      'visits' => (int)($row['visits'] ?? 0),
      'uniqueVisitors' => (int)($row['unique_visitors'] ?? 0),
    ];
  }
  return $out;
}

function event_analytics_campaigns(PDO $pdo, int $eventId, int $days, int $limit = 10): array {
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  $sinceSql = event_analytics_since_sql($driver, $days);
  $limit = max(1, min(30, $limit));

  $sql = "SELECT utm_campaign AS campaign,
                 COUNT(*) AS visits,
                 COUNT(DISTINCT visitor_key) AS unique_visitors
          FROM event_page_visits
          WHERE event_id = ? AND {$sinceSql}
            AND utm_campaign IS NOT NULL AND utm_campaign <> ''
          GROUP BY utm_campaign
          ORDER BY visits DESC
          LIMIT {$limit}";
  $stmt = $pdo->prepare($sql);
  $stmt->execute([$eventId]);

  $out = [];
  while ($row = $stmt->fetch()) {
    $out[] = [
      'campaign' => (string)($row['campaign'] ?? ''),
      'visits' => (int)($row['visits'] ?? 0),
      'uniqueVisitors' => (int)($row['unique_visitors'] ?? 0),
    ];
  }
  return $out;
}

function event_analytics_recent_visits(PDO $pdo, int $eventId, int $limit = 40): array {
  $limit = max(1, min(100, $limit));
  $stmt = $pdo->prepare(
    "SELECT id, visitor_key, source, referrer, referrer_host, utm_source, utm_medium, utm_campaign, path, created_at
     FROM event_page_visits
     WHERE event_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT {$limit}"
  );
  $stmt->execute([$eventId]);

  $out = [];
  while ($row = $stmt->fetch()) {
    $out[] = [
      'id' => (string)$row['id'],
      'visitorKey' => substr((string)$row['visitor_key'], 0, 8) . '…',
      'source' => (string)($row['source'] ?? 'Direct'),
      'referrer' => $row['referrer'] !== null ? (string)$row['referrer'] : null,
      'referrerHost' => $row['referrer_host'] !== null ? (string)$row['referrer_host'] : null,
      'utmSource' => $row['utm_source'] !== null ? (string)$row['utm_source'] : null,
      'utmMedium' => $row['utm_medium'] !== null ? (string)$row['utm_medium'] : null,
      'utmCampaign' => $row['utm_campaign'] !== null ? (string)$row['utm_campaign'] : null,
      'path' => $row['path'] !== null ? (string)$row['path'] : null,
      'visitedAt' => (string)$row['created_at'],
    ];
  }
  return $out;
}

function event_analytics_summary_counts(PDO $pdo, int $eventId, int $days): array {
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  $sinceSql = event_analytics_since_sql($driver, $days);

  $stmt = $pdo->prepare(
    "SELECT COUNT(*) AS visits, COUNT(DISTINCT visitor_key) AS unique_visitors
     FROM event_page_visits
     WHERE event_id = ? AND {$sinceSql}"
  );
  $stmt->execute([$eventId]);
  $row = $stmt->fetch() ?: [];

  if ($driver === 'sqlite') {
    $todayStmt = $pdo->prepare(
      "SELECT COUNT(*) FROM event_page_visits
       WHERE event_id = ? AND date(created_at) = date('now')"
    );
    $todayStmt->execute([$eventId]);
  } elseif ($driver === 'pgsql') {
    $todayStmt = $pdo->prepare(
      'SELECT COUNT(*) FROM event_page_visits
       WHERE event_id = ? AND DATE(created_at) = CURRENT_DATE'
    );
    $todayStmt->execute([$eventId]);
  } else {
    $todayStmt = $pdo->prepare(
      'SELECT COUNT(*) FROM event_page_visits
       WHERE event_id = ? AND DATE(created_at) = CURDATE()'
    );
    $todayStmt->execute([$eventId]);
  }

  return [
    'totalVisits' => (int)($row['visits'] ?? 0),
    'uniqueVisitors' => (int)($row['unique_visitors'] ?? 0),
    'visitsToday' => (int)$todayStmt->fetchColumn(),
  ];
}

function event_analytics_sales_snapshot(PDO $pdo, int $eventId): array {
  $orders = 0;
  $ticketsSold = 0;

  try {
    $orderStmt = $pdo->prepare(
      "SELECT COUNT(*) FROM orders WHERE event_id = ? AND status = 'paid'"
    );
    $orderStmt->execute([$eventId]);
    $orders = (int)$orderStmt->fetchColumn();
  } catch (Throwable $e) {
    $orders = 0;
  }

  try {
    $ticketStmt = $pdo->prepare('SELECT COALESCE(SUM(sold), 0) FROM tickets WHERE event_id = ?');
    $ticketStmt->execute([$eventId]);
    $ticketsSold = (int)$ticketStmt->fetchColumn();
  } catch (Throwable $e) {
    $ticketsSold = 0;
  }

  return [
    'orders' => $orders,
    'ticketsSold' => $ticketsSold,
  ];
}

function build_event_analytics_payload(PDO $pdo, int $eventId, int $days): array {
  ensure_event_analytics_tables($pdo);
  $days = event_analytics_days($days);
  $summary = event_analytics_summary_counts($pdo, $eventId, $days);
  $sources = event_analytics_sources($pdo, $eventId, $days);
  $sales = event_analytics_sales_snapshot($pdo, $eventId);
  $unique = max(0, (int)$summary['uniqueVisitors']);
  $conversionRate = $unique > 0 ? round(((int)$sales['orders']) / $unique, 4) : 0;

  return [
    'days' => $days,
    'summary' => [
      'totalVisits' => (int)$summary['totalVisits'],
      'uniqueVisitors' => $unique,
      'visitsToday' => (int)$summary['visitsToday'],
      'topSource' => $sources[0]['source'] ?? null,
    ],
    'visitsByDay' => event_analytics_visits_by_day($pdo, $eventId, $days),
    'sources' => $sources,
    'campaigns' => event_analytics_campaigns($pdo, $eventId, $days),
    'recentVisits' => event_analytics_recent_visits($pdo, $eventId, 50),
    'sales' => [
      'orders' => (int)$sales['orders'],
      'ticketsSold' => (int)$sales['ticketsSold'],
      'conversionRate' => $conversionRate,
    ],
  ];
}
