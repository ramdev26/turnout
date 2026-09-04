<?php

/**
 * SMSlenz.lk transactional SMS (https://smslenz.lk/api).
 */

function sms_config(): array {
  $cfg = get_config();
  $sms = is_array($cfg['sms'] ?? null) ? $cfg['sms'] : [];
  $senderId = trim((string)($sms['sender_id'] ?? ''));
  // Docs placeholder — fall back to the approved Turnout mask.
  if ($senderId === '' || strcasecmp($senderId, 'YOURBRAND') === 0 || strcasecmp($senderId, 'SMSlenzDEMO') === 0) {
    $sms['sender_id'] = 'TURNOUT';
  }
  return $sms;
}

function sms_enabled(): bool {
  $sms = sms_config();
  if (strtolower((string)($sms['enabled'] ?? 'true')) === 'false') {
    return false;
  }
  $userId = trim((string)($sms['user_id'] ?? ''));
  $apiKey = trim((string)($sms['api_key'] ?? ''));
  $senderId = trim((string)($sms['sender_id'] ?? ''));
  return $userId !== '' && $apiKey !== '' && $senderId !== '';
}

/**
 * Normalize Sri Lankan (and E.164) mobiles to +94XXXXXXXXX for SMSlenz.
 */
function sms_normalize_contact(string $raw): ?string {
  $raw = trim($raw);
  if ($raw === '') {
    return null;
  }

  // Keep leading +, strip other non-digits.
  $hasPlus = str_starts_with($raw, '+');
  $digits = preg_replace('/\D+/', '', $raw) ?? '';
  if ($digits === '') {
    return null;
  }

  // Local SL: 07XXXXXXXX → 947XXXXXXXX
  if (preg_match('/^0(7\d{8})$/', $digits, $m)) {
    $digits = '94' . $m[1];
  } elseif (preg_match('/^7\d{8}$/', $digits)) {
    $digits = '94' . $digits;
  }

  // Already 94… without plus
  if (str_starts_with($digits, '94') && strlen($digits) === 11) {
    return '+' . $digits;
  }

  // Other E.164 (with or without +) — require 10–15 digits
  if ($hasPlus || strlen($digits) >= 10) {
    if (strlen($digits) < 10 || strlen($digits) > 15) {
      return null;
    }
    return '+' . $digits;
  }

  return null;
}

/**
 * POST form fields to SMSlenz (supports application/x-www-form-urlencoded).
 *
 * @param array<string, scalar|array> $fields
 * @return array{ok:bool,status:int,body:array|null,raw:string}
 */
function smslenz_request(string $path, array $fields): array {
  $sms = sms_config();
  $base = rtrim((string)($sms['api_base_url'] ?? 'https://smslenz.lk/api'), '/');
  $url = $base . '/' . ltrim($path, '/');

  $payload = [];
  foreach ($fields as $key => $value) {
    if (is_array($value)) {
      $payload[$key] = json_encode(array_values($value), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    } else {
      $payload[$key] = (string)$value;
    }
  }

  if (!function_exists('curl_init')) {
    error_log('[turnout] sms: curl extension missing');
    return ['ok' => false, 'status' => 0, 'body' => null, 'raw' => ''];
  }

  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => http_build_query($payload),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 20,
    CURLOPT_CONNECTTIMEOUT => 8,
    CURLOPT_HTTPHEADER => [
      'Accept: application/json',
      'Content-Type: application/x-www-form-urlencoded',
    ],
  ]);
  $raw = curl_exec($ch);
  $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $err = curl_error($ch);
  curl_close($ch);

  if ($raw === false) {
    error_log('[turnout] sms request failed: ' . $err);
    return ['ok' => false, 'status' => $status, 'body' => null, 'raw' => ''];
  }

  $raw = (string)$raw;
  $body = null;
  try {
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) {
      $body = $decoded;
    }
  } catch (Throwable $e) {
    $body = null;
  }

  $ok = $status >= 200 && $status < 300 && is_array($body) && !empty($body['success']);
  if (!$ok) {
    error_log(sprintf('[turnout] sms HTTP %d: %s', $status, mb_substr($raw, 0, 400)));
  }

  return ['ok' => $ok, 'status' => $status, 'body' => $body, 'raw' => $raw];
}

/**
 * Send a single SMS. Returns true on provider success.
 */
function send_sms(string $contact, string $message): bool {
  if (!sms_enabled()) {
    return false;
  }

  $normalized = sms_normalize_contact($contact);
  if ($normalized === null) {
    error_log('[turnout] sms: invalid contact ' . mb_substr($contact, 0, 32));
    return false;
  }

  $message = trim($message);
  if ($message === '') {
    return false;
  }
  if (mb_strlen($message) > 1500) {
    $message = mb_substr($message, 0, 1500);
  }

  $sms = sms_config();
  $res = smslenz_request('send-sms', [
    'user_id' => (string)$sms['user_id'],
    'api_key' => (string)$sms['api_key'],
    'sender_id' => (string)$sms['sender_id'],
    'contact' => $normalized,
    'message' => $message,
  ]);

  return $res['ok'];
}

/**
 * Send the same message to multiple contacts.
 *
 * @param list<string> $contacts
 */
function send_bulk_sms(array $contacts, string $message): bool {
  if (!sms_enabled()) {
    return false;
  }

  $normalized = [];
  foreach ($contacts as $c) {
    $n = sms_normalize_contact((string)$c);
    if ($n !== null) {
      $normalized[$n] = true;
    }
  }
  $list = array_keys($normalized);
  if (count($list) === 0) {
    return false;
  }

  $message = trim($message);
  if ($message === '') {
    return false;
  }
  if (mb_strlen($message) > 1500) {
    $message = mb_substr($message, 0, 1500);
  }

  $sms = sms_config();
  $res = smslenz_request('send-bulk-sms', [
    'user_id' => (string)$sms['user_id'],
    'api_key' => (string)$sms['api_key'],
    'sender_id' => (string)$sms['sender_id'],
    'contacts' => $list,
    'message' => $message,
  ]);

  return $res['ok'];
}

function sms_format_lkr_from_cents(int $cents): string {
  return 'LKR ' . number_format(max(0, $cents) / 100, 2);
}

function ensure_order_confirmation_sms_column(PDO $pdo): void {
  static $checked = false;
  if ($checked) {
    return;
  }
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  $type = $driver === 'pgsql' ? 'TIMESTAMP NULL' : 'DATETIME NULL';
  try {
    if ($driver === 'pgsql') {
      $pdo->exec("ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmation_sms_sent_at {$type}");
    } else {
      $pdo->exec("ALTER TABLE orders ADD COLUMN confirmation_sms_sent_at {$type}");
    }
  } catch (Throwable $e) {
    // Column may already exist.
  }
  $checked = true;
}

/**
 * Atomically claim the right to send confirmation SMS for this order.
 * Returns false if SMS was already claimed/sent (prevents duplicates).
 */
function claim_order_confirmation_sms_slot(PDO $pdo, int $orderId): bool {
  ensure_order_confirmation_sms_column($pdo);
  $stmt = $pdo->prepare(
    'UPDATE orders
     SET confirmation_sms_sent_at = CURRENT_TIMESTAMP
     WHERE id = ? AND confirmation_sms_sent_at IS NULL'
  );
  $stmt->execute([$orderId]);
  return $stmt->rowCount() > 0;
}

function release_order_confirmation_sms_slot(PDO $pdo, int $orderId): void {
  try {
    ensure_order_confirmation_sms_column($pdo);
    $stmt = $pdo->prepare(
      'UPDATE orders SET confirmation_sms_sent_at = NULL WHERE id = ?'
    );
    $stmt->execute([$orderId]);
  } catch (Throwable $e) {
    error_log('[turnout] failed to release confirmation SMS slot for order ' . $orderId);
  }
}

/**
 * Buyer transaction SMS after a successful paid/free order confirmation.
 * Idempotent: at most one successful send per order.
 */
function send_order_confirmation_sms(PDO $pdo, int $orderId): bool {
  if (!sms_enabled()) {
    return false;
  }

  if (!claim_order_confirmation_sms_slot($pdo, $orderId)) {
    // Already sent (or claimed by a concurrent fulfillment path).
    return false;
  }

  $stmt = $pdo->prepare(
    'SELECT o.id, o.buyer_name, o.buyer_phone, o.total_amount_cents, o.tickets_json,
            e.title AS event_title, e.event_date, e.location, e.customization_json, e.organizer_user_id
     FROM orders o
     INNER JOIN events e ON e.id = o.event_id
     WHERE o.id = ?
     LIMIT 1'
  );
  $stmt->execute([$orderId]);
  $order = $stmt->fetch();
  if (!$order) {
    release_order_confirmation_sms_slot($pdo, $orderId);
    return false;
  }

  $phone = trim((string)($order['buyer_phone'] ?? ''));
  if ($phone === '') {
    // Nothing to send — keep claim so we do not retry forever for phoneless orders.
    return false;
  }

  $name = trim((string)($order['buyer_name'] ?? ''));
  $greeting = $name !== '' ? $name : 'Valued Customer';
  $eventTitle = trim((string)($order['event_title'] ?? 'your event'));
  $location = trim((string)($order['location'] ?? ''));
  $total = sms_format_lkr_from_cents((int)($order['total_amount_cents'] ?? 0));
  $bookingId = (string)(int)$order['id'];
  $ticketUrl = mail_order_short_ticket_url($orderId);
  if ($ticketUrl === '') {
    $ticketUrl = mail_order_success_url($orderId);
  }

  $customization = json_decode((string)($order['customization_json'] ?? ''), true);
  $scheduleTba = is_array($customization) && !empty($customization['scheduleTba']);
  $when = 'date to be announced';
  if (!$scheduleTba) {
    $ts = strtotime((string)($order['event_date'] ?? ''));
    if ($ts !== false) {
      $when = date('Y-m-d H:i', $ts);
    }
  }

  $lines = [];
  $lines[] = 'Dear ' . $greeting . ',';
  $lines[] = '';
  $eventLine = 'Your tickets for ' . $eventTitle;
  if ($when !== '') {
    $eventLine .= ' on ' . $when;
  }
  if ($location !== '') {
    $eventLine .= ' at ' . $location;
  }
  $eventLine .= ' have been confirmed.';
  $lines[] = $eventLine;
  $lines[] = '';
  $lines[] = 'Booking ID: ' . $bookingId;
  $lines[] = 'Total: ' . $total;
  $lines[] = '';
  if ($ticketUrl !== '') {
    $lines[] = 'Download your e-ticket(s) here:';
    $lines[] = $ticketUrl;
    $lines[] = '';
  } else {
    $lines[] = 'Check your email for your e-tickets.';
    $lines[] = '';
  }

  $organizerName = '';
  if (function_exists('mail_resolve_organizer_name')) {
    $organizerName = mail_resolve_organizer_name($pdo, (int)($order['organizer_user_id'] ?? 0));
  }
  if ($organizerName !== '' && strcasecmp($organizerName, 'Organizer') !== 0) {
    $lines[] = 'See you at the event — ' . $organizerName;
  } else {
    $lines[] = 'See you at the event.';
  }

  $message = implode("\n", $lines);
  if (mb_strlen($message) > 1500) {
    $message = mb_substr($message, 0, 1500);
  }

  $ok = send_sms($phone, $message);
  if (!$ok) {
    release_order_confirmation_sms_slot($pdo, $orderId);
    error_log('[turnout] order confirmation SMS failed for order ' . $orderId);
  }
  return $ok;
}
