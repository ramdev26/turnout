<?php

function admin_analytics_days(): int {
  $days = (int)(getenv('ADMIN_ANALYTICS_DAYS') ?: 30);
  return max(7, min(90, $days));
}

function admin_fill_day_series(array $rows, string $valueKey, int $days): array {
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
      $valueKey => is_array($hit) ? (float)($hit[$valueKey] ?? 0) : 0,
      'transactions' => is_array($hit) ? (int)($hit['transactions'] ?? 0) : 0,
    ];
  }
  return $series;
}

function admin_fill_signup_series(array $rows, int $days): array {
  $map = [];
  foreach ($rows as $row) {
    if (!is_array($row)) continue;
    $day = (string)($row['day'] ?? '');
    if ($day === '') continue;
    $map[$day] = (int)($row['signups'] ?? 0);
  }

  $series = [];
  $today = new DateTimeImmutable('today');
  for ($i = $days - 1; $i >= 0; $i--) {
    $date = $today->sub(new DateInterval('P' . $i . 'D'))->format('Y-m-d');
    $series[] = [
      'date' => $date,
      'signups' => $map[$date] ?? 0,
    ];
  }
  return $series;
}

function admin_revenue_by_day(PDO $pdo, int $days): array {
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  if ($driver === 'sqlite') {
    $stmt = $pdo->query(
      "SELECT date(created_at) AS day,
              COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN amount_cents ELSE 0 END), 0) AS revenue,
              COUNT(*) AS transactions
       FROM transactions
       WHERE date(created_at) >= date('now', '-{$days} days')
       GROUP BY date(created_at)
       ORDER BY day ASC"
    );
  } elseif ($driver === 'pgsql') {
    $stmt = $pdo->query(
      "SELECT DATE(created_at) AS day,
              COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN amount_cents ELSE 0 END), 0) AS revenue,
              COUNT(*) AS transactions
       FROM transactions
       WHERE created_at >= CURRENT_DATE - INTERVAL '{$days} days'
       GROUP BY DATE(created_at)
       ORDER BY day ASC"
    );
  } else {
    $stmt = $pdo->query(
      "SELECT DATE(created_at) AS day,
              COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN amount_cents ELSE 0 END), 0) AS revenue,
              COUNT(*) AS transactions
       FROM transactions
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL " . ($days - 1) . " DAY)
       GROUP BY DATE(created_at)
       ORDER BY day ASC"
    );
  }

  $rows = [];
  while ($row = $stmt->fetch()) {
    $rows[] = [
      'day' => (string)$row['day'],
      'revenue' => ((int)($row['revenue'] ?? 0)) / 100,
      'transactions' => (int)($row['transactions'] ?? 0),
    ];
  }
  return admin_fill_day_series($rows, 'revenue', $days);
}

function admin_signups_by_day(PDO $pdo, int $days): array {
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  if ($driver === 'sqlite') {
    $stmt = $pdo->query(
      "SELECT date(created_at) AS day, COUNT(*) AS signups
       FROM users
       WHERE date(created_at) >= date('now', '-{$days} days')
       GROUP BY date(created_at)
       ORDER BY day ASC"
    );
  } elseif ($driver === 'pgsql') {
    $stmt = $pdo->query(
      "SELECT DATE(created_at) AS day, COUNT(*) AS signups
       FROM users
       WHERE created_at >= CURRENT_DATE - INTERVAL '{$days} days'
       GROUP BY DATE(created_at)
       ORDER BY day ASC"
    );
  } else {
    $stmt = $pdo->query(
      "SELECT DATE(created_at) AS day, COUNT(*) AS signups
       FROM users
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL " . ($days - 1) . " DAY)
       GROUP BY DATE(created_at)
       ORDER BY day ASC"
    );
  }

  $rows = [];
  while ($row = $stmt->fetch()) {
    $rows[] = [
      'day' => (string)$row['day'],
      'signups' => (int)($row['signups'] ?? 0),
    ];
  }
  return admin_fill_signup_series($rows, $days);
}

function admin_transactions_by_status(PDO $pdo): array {
  $stmt = $pdo->query(
    "SELECT payment_status AS status,
            COUNT(*) AS count,
            COALESCE(SUM(amount_cents), 0) AS amount_cents
     FROM transactions
     GROUP BY payment_status
     ORDER BY count DESC"
  );
  $labels = [
    'paid' => 'Paid',
    'pending' => 'Pending',
    'failed' => 'Failed',
  ];
  $out = [];
  while ($row = $stmt->fetch()) {
    $status = (string)($row['status'] ?? 'unknown');
    $out[] = [
      'status' => $labels[$status] ?? ucfirst($status),
      'count' => (int)($row['count'] ?? 0),
      'amount' => ((int)($row['amount_cents'] ?? 0)) / 100,
    ];
  }
  return $out;
}

function admin_user_role_breakdown(PDO $pdo): array {
  $stmt = $pdo->query(
    "SELECT role, COUNT(*) AS count
     FROM users
     GROUP BY role
     ORDER BY count DESC"
  );
  $labels = [
    'organizer' => 'Organizers',
    'attendee' => 'Attendees',
    'super_admin' => 'Super Admins',
  ];
  $out = [];
  while ($row = $stmt->fetch()) {
    $role = (string)($row['role'] ?? 'unknown');
    $out[] = [
      'role' => $labels[$role] ?? ucfirst($role),
      'count' => (int)($row['count'] ?? 0),
    ];
  }
  return $out;
}

function admin_build_chart_payload(PDO $pdo): array {
  $days = admin_analytics_days();
  return [
    'days' => $days,
    'revenueByDay' => admin_revenue_by_day($pdo, $days),
    'signupsByDay' => admin_signups_by_day($pdo, $days),
    'transactionsByStatus' => admin_transactions_by_status($pdo),
    'usersByRole' => admin_user_role_breakdown($pdo),
  ];
}
