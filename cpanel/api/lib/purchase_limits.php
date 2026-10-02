<?php

/**
 * Event purchase limits — cap tickets per order and per customer (email/phone).
 */

function event_purchase_limits_from_row(array $eventRow): array {
  $custom = json_decode((string)($eventRow['customization_json'] ?? ''), true);
  if (!is_array($custom)) $custom = [];
  return normalize_purchase_limits_config($custom);
}

function normalize_purchase_limits_config(array $custom): array {
  $perOrder = null;
  if (array_key_exists('maxTicketsPerOrder', $custom) && $custom['maxTicketsPerOrder'] !== null && $custom['maxTicketsPerOrder'] !== '') {
    $n = (int)$custom['maxTicketsPerOrder'];
    if ($n >= 1) $perOrder = min(100, $n);
  }
  $perCustomer = null;
  if (array_key_exists('maxTicketsPerCustomer', $custom) && $custom['maxTicketsPerCustomer'] !== null && $custom['maxTicketsPerCustomer'] !== '') {
    $n = (int)$custom['maxTicketsPerCustomer'];
    if ($n >= 1) $perCustomer = min(100, $n);
  }
  return [
    'maxTicketsPerOrder' => $perOrder,
    'maxTicketsPerCustomer' => $perCustomer,
    'enabled' => $perOrder !== null || $perCustomer !== null,
  ];
}

function set_event_purchase_limits(PDO $pdo, int $eventId, ?int $maxPerOrder, ?int $maxPerCustomer): array {
  if (function_exists('load_event_customization_row')) {
    $custom = load_event_customization_row($pdo, $eventId);
  } else {
    $stmt = $pdo->prepare('SELECT customization_json FROM events WHERE id = ? LIMIT 1');
    $stmt->execute([$eventId]);
    $row = $stmt->fetch();
    if (!$row) json_response(404, ['error' => 'event_not_found']);
    $custom = json_decode((string)$row['customization_json'], true);
    if (!is_array($custom)) $custom = [];
  }

  if ($maxPerOrder !== null && $maxPerOrder >= 1) {
    $custom['maxTicketsPerOrder'] = min(100, $maxPerOrder);
  } else {
    unset($custom['maxTicketsPerOrder']);
  }
  if ($maxPerCustomer !== null && $maxPerCustomer >= 1) {
    $custom['maxTicketsPerCustomer'] = min(100, $maxPerCustomer);
  } else {
    unset($custom['maxTicketsPerCustomer']);
  }

  if (function_exists('save_event_customization')) {
    save_event_customization($pdo, $eventId, $custom);
  } else {
    $upd = $pdo->prepare('UPDATE events SET customization_json = ? WHERE id = ?');
    $upd->execute([json_encode($custom, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), $eventId]);
  }

  return normalize_purchase_limits_config($custom);
}

function parse_optional_positive_limit($raw): ?int {
  if ($raw === null || $raw === '' || $raw === false) return null;
  $n = (int)$raw;
  if ($n < 1) return null;
  return min(100, $n);
}

function normalize_purchase_limit_phone(string $phone): string {
  $digits = preg_replace('/\D+/', '', $phone) ?? '';
  if ($digits === '') return '';
  // Compare on a stable suffix so +94… and 0… variants can match.
  if (strlen($digits) > 10) {
    return substr($digits, -10);
  }
  return $digits;
}

function order_items_ticket_quantity(array $normalizedItems): int {
  $sum = 0;
  foreach ($normalizedItems as $it) {
    if (!is_array($it)) continue;
    $sum += max(0, (int)($it['quantity'] ?? 0));
  }
  return $sum;
}

function tickets_json_quantity(?string $json): int {
  if ($json === null || $json === '') return 0;
  $items = json_decode($json, true);
  if (!is_array($items)) return 0;
  return order_items_ticket_quantity($items);
}

/**
 * Count tickets already held for this event by email and/or phone.
 * Includes paid attendees and pending public orders (PayHere / bank transfer).
 */
function count_customer_tickets_for_event(PDO $pdo, int $eventId, string $email, string $phone): int {
  $email = strtolower(trim($email));
  $phoneNorm = normalize_purchase_limit_phone($phone);
  if ($email === '' && $phoneNorm === '') return 0;

  $counted = 0;

  // Issued tickets (paid / complimentary attendees). Phone matched in PHP for portable normalization.
  $stmt = $pdo->prepare('SELECT email, phone FROM attendees WHERE event_id = ?');
  $stmt->execute([$eventId]);
  while ($row = $stmt->fetch()) {
    $rowEmail = strtolower(trim((string)($row['email'] ?? '')));
    $rowPhone = normalize_purchase_limit_phone((string)($row['phone'] ?? ''));
    $emailMatch = $email !== '' && $rowEmail === $email;
    $phoneMatch = $phoneNorm !== '' && $rowPhone !== '' && $rowPhone === $phoneNorm;
    if ($emailMatch || $phoneMatch) $counted++;
  }

  // Pending checkout orders that have not issued attendees yet.
  $pending = $pdo->prepare(
    "SELECT buyer_email, buyer_phone, tickets_json FROM orders
     WHERE event_id = ? AND status = 'pending'"
  );
  $pending->execute([$eventId]);
  while ($row = $pending->fetch()) {
    $rowEmail = strtolower(trim((string)($row['buyer_email'] ?? '')));
    $rowPhone = normalize_purchase_limit_phone((string)($row['buyer_phone'] ?? ''));
    $emailMatch = $email !== '' && $rowEmail === $email;
    $phoneMatch = $phoneNorm !== '' && $rowPhone !== '' && $rowPhone === $phoneNorm;
    if ($emailMatch || $phoneMatch) {
      $counted += tickets_json_quantity(isset($row['tickets_json']) ? (string)$row['tickets_json'] : null);
    }
  }

  return $counted;
}

/**
 * Enforce purchase limits for a public checkout attempt.
 * @param array $attendees List of attendee payloads (may include email/phone per holder)
 */
function enforce_purchase_limits(
  PDO $pdo,
  array $eventRow,
  array $normalizedItems,
  string $buyerEmail,
  string $buyerPhone,
  array $attendees = []
): void {
  $limits = event_purchase_limits_from_row($eventRow);
  if (!$limits['enabled']) return;

  $orderQty = order_items_ticket_quantity($normalizedItems);
  if ($orderQty < 1) return;

  $maxPerOrder = $limits['maxTicketsPerOrder'];
  if ($maxPerOrder !== null && $orderQty > $maxPerOrder) {
    json_response(400, [
      'error' => 'max_tickets_per_order',
      'message' => $maxPerOrder === 1
        ? 'This event allows only 1 ticket per order.'
        : "This event allows at most {$maxPerOrder} tickets per order.",
      'maxTicketsPerOrder' => $maxPerOrder,
      'requested' => $orderQty,
    ]);
  }

  $maxPerCustomer = $limits['maxTicketsPerCustomer'];
  if ($maxPerCustomer === null) return;

  $identities = [];
  $buyerEmail = strtolower(trim($buyerEmail));
  $buyerPhone = trim($buyerPhone);
  if ($buyerEmail !== '') {
    $identities[] = ['email' => $buyerEmail, 'phone' => $buyerPhone];
  } elseif ($buyerPhone !== '') {
    $identities[] = ['email' => '', 'phone' => $buyerPhone];
  }

  foreach ($attendees as $a) {
    if (!is_array($a)) continue;
    $em = strtolower(trim((string)($a['email'] ?? '')));
    $ph = trim((string)($a['phone'] ?? ''));
    if ($em === '' && $ph === '') continue;
    $identities[] = ['email' => $em, 'phone' => $ph];
  }

  // Deduplicate identities.
  $seen = [];
  $unique = [];
  foreach ($identities as $id) {
    $key = ($id['email'] !== '' ? 'e:' . $id['email'] : '') . '|p:' . normalize_purchase_limit_phone($id['phone']);
    if (isset($seen[$key])) continue;
    $seen[$key] = true;
    $unique[] = $id;
  }

  foreach ($unique as $id) {
    $already = count_customer_tickets_for_event($pdo, (int)$eventRow['id'], $id['email'], $id['phone']);
    // How many tickets in THIS order belong to this identity?
    $inThisOrder = 0;
    if ($id['email'] !== '' && $id['email'] === $buyerEmail) {
      $inThisOrder = $orderQty;
    } else {
      foreach ($attendees as $a) {
        if (!is_array($a)) continue;
        $em = strtolower(trim((string)($a['email'] ?? '')));
        $ph = trim((string)($a['phone'] ?? ''));
        $emailMatch = $id['email'] !== '' && $em === $id['email'];
        $phoneMatch =
          normalize_purchase_limit_phone($id['phone']) !== '' &&
          normalize_purchase_limit_phone($ph) !== '' &&
          normalize_purchase_limit_phone($ph) === normalize_purchase_limit_phone($id['phone']);
        if ($emailMatch || $phoneMatch) $inThisOrder++;
      }
      if ($inThisOrder < 1 && $id['email'] === $buyerEmail) $inThisOrder = $orderQty;
    }

    // If identity is only the buyer and attendees use different emails,
    // still attribute the full order to the buyer email.
    if ($inThisOrder < 1 && $id['email'] !== '' && $id['email'] === $buyerEmail) {
      $inThisOrder = $orderQty;
    }

    if ($inThisOrder < 1) continue;

    if ($already + $inThisOrder > $maxPerCustomer) {
      $remaining = max(0, $maxPerCustomer - $already);
      $who = $id['email'] !== '' ? $id['email'] : 'this phone number';
      json_response(400, [
        'error' => 'max_tickets_per_customer',
        'message' => $maxPerCustomer === 1
          ? "Only 1 ticket is allowed per customer for this event. {$who} has already reached the limit."
          : "This event allows at most {$maxPerCustomer} tickets per customer. {$who} can still get {$remaining}.",
        'maxTicketsPerCustomer' => $maxPerCustomer,
        'alreadyHeld' => $already,
        'remaining' => $remaining,
        'requested' => $inThisOrder,
      ]);
    }
  }
}
