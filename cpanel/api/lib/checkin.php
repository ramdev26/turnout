<?php

function load_event_customization_row(PDO $pdo, int $eventId): array {
  $stmt = $pdo->prepare('SELECT customization_json FROM events WHERE id = ? LIMIT 1');
  $stmt->execute([$eventId]);
  $row = $stmt->fetch();
  if (!$row) return [];
  $custom = json_decode((string)$row['customization_json'], true);
  return is_array($custom) ? $custom : [];
}

function save_event_customization(PDO $pdo, int $eventId, array $custom): void {
  $upd = $pdo->prepare('UPDATE events SET customization_json = ? WHERE id = ?');
  $upd->execute([json_encode($custom, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), $eventId]);
}

function normalize_checkin_pin(string $pin): string {
  $digits = preg_replace('/\D+/', '', $pin);
  if ($digits === null || strlen($digits) < 4) return '';
  return substr($digits, 0, 8);
}

function generate_checkin_pin(): string {
  return str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
}

function get_event_checkin_pin(PDO $pdo, int $eventId): ?string {
  $custom = load_event_customization_row($pdo, $eventId);
  $pin = normalize_checkin_pin((string)($custom['checkinPin'] ?? ''));
  return $pin !== '' ? $pin : null;
}

function set_event_checkin_pin(PDO $pdo, int $eventId, ?string $pin): string {
  $custom = load_event_customization_row($pdo, $eventId);
  $normalized = $pin !== null && $pin !== '' ? normalize_checkin_pin($pin) : '';
  if ($normalized === '' && $pin !== null && $pin !== '') {
    json_response(400, ['error' => 'invalid_checkin_pin', 'message' => 'PIN must be 4–8 digits.']);
  }
  if ($normalized === '') {
    unset($custom['checkinPin']);
    $generated = generate_checkin_pin();
    $custom['checkinPin'] = $generated;
    save_event_customization($pdo, $eventId, $custom);
    return $generated;
  }
  $custom['checkinPin'] = $normalized;
  save_event_customization($pdo, $eventId, $custom);
  return $normalized;
}

function verify_event_checkin_pin(PDO $pdo, int $eventId, string $pin): bool {
  $stored = get_event_checkin_pin($pdo, $eventId);
  if ($stored === null) return false;
  return hash_equals($stored, normalize_checkin_pin($pin));
}

function require_event_access(PDO $pdo, int $eventId, int $uid, string $minRole = 'editor'): void {
  $stmt = $pdo->prepare('SELECT * FROM events WHERE id = ? LIMIT 1');
  $stmt->execute([$eventId]);
  $row = $stmt->fetch();
  if (!$row) json_response(404, ['error' => 'event_not_found']);
  deny_unless_event_row_access($pdo, $row, $uid, $minRole);
}

function require_event_owner(PDO $pdo, int $eventId, int $uid, string $minRole = 'editor'): void {
  require_event_access($pdo, $eventId, $uid, $minRole);
}

function require_checkin_access(PDO $pdo, int $eventId, array $body): int {
  $uid = current_user_id();
  if ($uid !== null) {
    $user = load_user_profile($uid);
    if (($user['role'] ?? '') === 'organizer') {
      $stmt = $pdo->prepare('SELECT organizer_user_id FROM events WHERE id = ? LIMIT 1');
      $stmt->execute([$eventId]);
      $row = $stmt->fetch();
      if (!$row) json_response(404, ['error' => 'event_not_found']);
      if (user_can_access_event_row($pdo, $row, $uid, 'editor')) return $uid;
    }
  }

  $pin = normalize_checkin_pin((string)($body['staffPin'] ?? ''));
  if ($pin === '') json_response(401, ['error' => 'checkin_unauthorized', 'message' => 'Organizer login or staff PIN required.']);
  if (!verify_event_checkin_pin($pdo, $eventId, $pin)) {
    json_response(403, ['error' => 'invalid_staff_pin', 'message' => 'Invalid staff PIN for this event.']);
  }
  return 0;
}

function expected_attendee_count_from_items(array $items): int {
  $total = 0;
  foreach ($items as $it) {
    if (!is_array($it)) continue;
    $total += max(0, (int)($it['quantity'] ?? 0));
  }
  return $total;
}

function validate_attendees_for_order(array $normalizedItems, array $attendees, array $checkoutFields = []): void {
  $expected = expected_attendee_count_from_items($normalizedItems);
  if ($expected < 1) json_response(400, ['error' => 'invalid_order_items']);
  if (!is_array($attendees) || count($attendees) !== $expected) {
    json_response(400, [
      'error' => 'attendee_count_mismatch',
      'message' => 'Attendee count must match total ticket quantity (' . $expected . ').',
    ]);
  }

  $requiredByTicket = [];
  foreach ($normalizedItems as $it) {
    if (!is_array($it)) continue;
    $tid = (string)($it['ticketId'] ?? '');
    $qty = (int)($it['quantity'] ?? 0);
    if ($tid !== '' && $qty > 0) {
      $requiredByTicket[$tid] = ($requiredByTicket[$tid] ?? 0) + $qty;
    }
  }

  $providedByTicket = [];
  foreach ($attendees as $a) {
    if (!is_array($a)) json_response(400, ['error' => 'invalid_attendee']);
    $ticketId = (string)($a['ticketId'] ?? '');
    $fullName = trim((string)($a['fullName'] ?? ''));
    $email = strtolower(trim((string)($a['email'] ?? '')));
    if ($ticketId === '' || $fullName === '' || $email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
      json_response(400, ['error' => 'invalid_attendee', 'message' => 'Each attendee needs ticket, name, and valid email.']);
    }
    if (!isset($requiredByTicket[$ticketId])) {
      json_response(400, ['error' => 'invalid_attendee_ticket', 'message' => 'Attendee ticket does not match order.']);
    }
    validate_attendee_custom_fields($checkoutFields, $a['customFields'] ?? null);
    $providedByTicket[$ticketId] = ($providedByTicket[$ticketId] ?? 0) + 1;
  }

  foreach ($requiredByTicket as $tid => $qty) {
    if (($providedByTicket[$tid] ?? 0) !== $qty) {
      json_response(400, ['error' => 'attendee_ticket_mismatch', 'message' => 'Attendee rows must match each ticket quantity.']);
    }
  }
}

function attendee_api_shape(array $a, int $eventId): array {
  $shape = [
    'id' => (string)$a['id'],
    'eventId' => (string)$eventId,
    'ticketId' => (string)$a['ticket_id'],
    'ticketName' => (string)($a['ticket_name'] ?? ''),
    'fullName' => (string)$a['full_name'],
    'email' => (string)$a['email'],
    'phone' => $a['phone'] ?? null,
    'qrToken' => (string)$a['qr_token'],
    'checkedInAt' => !empty($a['checked_in_at']) ? gmdate('c', strtotime($a['checked_in_at'])) : null,
    'createdAt' => !empty($a['created_at']) ? gmdate('c', strtotime($a['created_at'])) : null,
  ];
  $custom = decode_attendee_custom_fields($a['custom_fields_json'] ?? null);
  if ($custom !== null) $shape['customFields'] = $custom;
  return $shape;
}

function insert_attendees_for_order(
  PDO $pdo,
  int $orderId,
  int $eventId,
  array $attendees,
  string $defaultEmail,
  string $defaultPhone,
  string $defaultName,
  array $checkoutFields = []
): int {
  ensure_attendees_custom_fields_column($pdo);
  $attIns = $pdo->prepare(
    'INSERT INTO attendees (order_id, event_id, ticket_id, full_name, email, phone, qr_token, custom_fields_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  $created = 0;
  foreach ($attendees as $a) {
    if (!is_array($a)) continue;
    $ticketId = (int)($a['ticketId'] ?? 0);
    $fullName = trim((string)($a['fullName'] ?? $defaultName));
    $email = strtolower(trim((string)($a['email'] ?? $defaultEmail)));
    $phone = trim((string)($a['phone'] ?? $defaultPhone));
    if ($ticketId <= 0 || $fullName === '' || $email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
      throw new Exception('invalid_attendee');
    }
    validate_attendee_custom_fields($checkoutFields, $a['customFields'] ?? null);
    $customJson = sanitize_attendee_custom_fields($checkoutFields, $a['customFields'] ?? null);
    $qr = bin2hex(random_bytes(16));
    $attIns->execute([$orderId, $eventId, $ticketId, $fullName, $email, $phone !== '' ? $phone : null, $qr, $customJson]);
    $created++;
  }
  return $created;
}

function normalize_qr_token_lookup(string $raw): string {
  $token = trim($raw);
  if ($token === '') return '';

  if (str_starts_with($token, '{')) {
    $parsed = json_decode($token, true);
    if (is_array($parsed)) {
      $token = trim((string)($parsed['qrToken'] ?? $parsed['token'] ?? ''));
    }
  }

  if (preg_match('/[a-fA-F0-9]{32}/', $token, $m)) {
    return strtolower($m[0]);
  }

  $hex = strtolower(preg_replace('/[^a-fA-F0-9]/', '', $token));
  return strlen($hex) === 32 ? $hex : '';
}

function staff_checkin_public_url(int $eventId): string {
  $path = '/staff/checkin/' . $eventId;
  $base = app_base_url();
  return $base !== '' ? $base . $path : $path;
}

function fetch_attendee_stats(PDO $pdo, int $eventId): array {
  $stmt = $pdo->prepare(
    'SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN checked_in_at IS NOT NULL THEN 1 ELSE 0 END) AS checked_in
     FROM attendees WHERE event_id = ?'
  );
  $stmt->execute([$eventId]);
  $row = $stmt->fetch() ?: ['total' => 0, 'checked_in' => 0];
  $total = (int)$row['total'];
  $checkedIn = (int)$row['checked_in'];
  return [
    'total' => $total,
    'checkedIn' => $checkedIn,
    'pending' => max(0, $total - $checkedIn),
  ];
}
