<?php

/**
 * Organizer Orders module — list/summary helpers for WooCommerce-style order management.
 */

function organizer_order_ticket_summary(array $items): array {
  $qty = 0;
  $labels = [];
  foreach ($items as $item) {
    if (!is_array($item)) continue;
    $q = max(0, (int)($item['quantity'] ?? 0));
    $qty += $q;
    $name = trim((string)($item['name'] ?? ''));
    if ($name !== '' && $q > 0) {
      $labels[] = $q > 1 ? "{$name} ×{$q}" : $name;
    }
  }
  return [
    'ticketCount' => $qty,
    'ticketSummary' => $labels !== [] ? implode(', ', $labels) : null,
  ];
}

function organizer_order_list_item(array $row, ?array $eventMeta = null): array {
  $items = json_decode((string)($row['tickets_json'] ?? ''), true);
  if (!is_array($items)) $items = [];
  $summary = organizer_order_ticket_summary($items);
  $payment = function_exists('map_order_payment_fields') ? map_order_payment_fields($row) : [];

  $couponCode = trim((string)($row['coupon_code'] ?? ''));
  $discountCents = isset($row['discount_amount_cents']) ? (int)$row['discount_amount_cents'] : 0;

  $out = array_merge([
    'id' => (string)$row['id'],
    'eventId' => (string)$row['event_id'],
    'eventTitle' => $eventMeta['title'] ?? null,
    'eventSlug' => $eventMeta['slug'] ?? null,
    'buyerName' => $row['buyer_name'] ?? null,
    'buyerEmail' => $row['buyer_email'] ?? null,
    'buyerPhone' => $row['buyer_phone'] ?? null,
    'tickets' => $items,
    'ticketCount' => $summary['ticketCount'],
    'ticketSummary' => $summary['ticketSummary'],
    'totalAmount' => ((int)($row['total_amount_cents'] ?? 0)) / 100,
    'status' => (string)($row['status'] ?? 'pending'),
    'couponCode' => $couponCode !== '' ? $couponCode : null,
    'discountAmount' => $discountCents > 0 ? $discountCents / 100 : 0,
    'createdAt' => !empty($row['created_at']) ? gmdate('c', strtotime((string)$row['created_at'])) : null,
  ], $payment);

  return $out;
}

/**
 * @param list<int> $ownerIds
 * @return array{orders: list<array>, total: int, counts: array<string,int>}
 */
function organizer_orders_query(
  PDO $pdo,
  array $ownerIds,
  array $filters = []
): array {
  if ($ownerIds === []) {
    return [
      'orders' => [],
      'total' => 0,
      'counts' => ['all' => 0, 'pending' => 0, 'paid' => 0, 'failed' => 0],
    ];
  }

  if (function_exists('ensure_order_bank_transfer_columns')) {
    ensure_order_bank_transfer_columns($pdo);
  }
  if (function_exists('ensure_order_coupon_columns')) {
    ensure_order_coupon_columns($pdo);
  }

  $ownerPlaceholders = implode(',', array_fill(0, count($ownerIds), '?'));
  $where = ["e.organizer_user_id IN ($ownerPlaceholders)"];
  $params = $ownerIds;

  $status = trim((string)($filters['status'] ?? 'all'));
  if (in_array($status, ['pending', 'paid', 'failed'], true)) {
    $where[] = 'o.status = ?';
    $params[] = $status;
  }

  $eventId = (int)($filters['eventId'] ?? 0);
  if ($eventId > 0) {
    $where[] = 'o.event_id = ?';
    $params[] = $eventId;
  }

  $paymentMethod = trim((string)($filters['paymentMethod'] ?? ''));
  if ($paymentMethod !== '' && $paymentMethod !== 'all') {
    $where[] = 'o.payment_method = ?';
    $params[] = $paymentMethod;
  }

  $q = trim((string)($filters['q'] ?? ''));
  if ($q !== '') {
    $like = '%' . mb_strtolower($q) . '%';
    $searchParts = [
      'LOWER(COALESCE(o.buyer_name, \'\')) LIKE ?',
      'LOWER(COALESCE(o.buyer_email, \'\')) LIKE ?',
      'LOWER(COALESCE(o.buyer_phone, \'\')) LIKE ?',
    ];
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
    if (preg_match('/^\d+$/', $q)) {
      $searchParts[] = 'o.id = ?';
      $params[] = (int)$q;
    }
    $where[] = '(' . implode(' OR ', $searchParts) . ')';
  }

  $whereSql = implode(' AND ', $where);

  $countSql =
    "SELECT o.status, COUNT(*) AS cnt
     FROM orders o
     INNER JOIN events e ON e.id = o.event_id
     WHERE e.organizer_user_id IN ($ownerPlaceholders)
     GROUP BY o.status";
  $countStmt = $pdo->prepare($countSql);
  $countStmt->execute($ownerIds);
  $counts = ['all' => 0, 'pending' => 0, 'paid' => 0, 'failed' => 0];
  while ($c = $countStmt->fetch()) {
    $st = (string)($c['status'] ?? '');
    $n = (int)($c['cnt'] ?? 0);
    if (isset($counts[$st])) $counts[$st] = $n;
    $counts['all'] += $n;
  }

  $totalSql =
    "SELECT COUNT(*) AS total
     FROM orders o
     INNER JOIN events e ON e.id = o.event_id
     WHERE $whereSql";
  $totalStmt = $pdo->prepare($totalSql);
  $totalStmt->execute($params);
  $total = (int)($totalStmt->fetch()['total'] ?? 0);

  $limit = (int)($filters['limit'] ?? 50);
  if ($limit < 1) $limit = 50;
  if ($limit > 200) $limit = 200;
  $offset = max(0, (int)($filters['offset'] ?? 0));

  $sql =
    "SELECT o.*, e.title AS event_title, e.slug AS event_slug
     FROM orders o
     INNER JOIN events e ON e.id = o.event_id
     WHERE $whereSql
     ORDER BY o.created_at DESC, o.id DESC
     LIMIT $limit OFFSET $offset";
  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);

  $orders = [];
  while ($row = $stmt->fetch()) {
    $orders[] = organizer_order_list_item($row, [
      'title' => (string)($row['event_title'] ?? ''),
      'slug' => (string)($row['event_slug'] ?? ''),
    ]);
  }

  return [
    'orders' => $orders,
    'total' => $total,
    'counts' => $counts,
  ];
}
