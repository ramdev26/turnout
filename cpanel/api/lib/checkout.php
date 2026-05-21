<?php

function map_public_event_row(array $row): array {
  return [
    'id' => (string)$row['id'],
    'slug' => $row['slug'],
    'organizerId' => (string)$row['organizer_user_id'],
    'title' => $row['title'],
    'description' => $row['description'],
    'date' => gmdate('c', strtotime($row['event_date'])),
    'location' => $row['location'],
    'bannerUrl' => $row['banner_url'],
    'templateId' => $row['template_id'],
    'customization' => json_decode((string)$row['customization_json'], true),
    'status' => $row['status'],
    'createdAt' => gmdate('c', strtotime($row['created_at'])),
  ];
}

function is_event_publicly_visible(array $row): bool {
  if ((string)($row['status'] ?? '') !== 'published') return false;
  $moderation = (string)($row['event_status'] ?? 'approved');
  return $moderation === 'approved';
}

function require_publishable_event(PDO $pdo, int $eventId): array {
  $stmt = $pdo->prepare('SELECT * FROM events WHERE id = ? LIMIT 1');
  $stmt->execute([$eventId]);
  $row = $stmt->fetch();
  if (!$row || !is_event_publicly_visible($row)) {
    json_response(404, ['error' => 'event_not_found']);
  }
  return $row;
}

function normalize_order_items_from_db(PDO $pdo, int $eventId, array $items): array {
  $totalCents = 0;
  $normalizedItems = [];
  $ticketStmt = $pdo->prepare('SELECT id, name, price_cents, quantity, sold FROM tickets WHERE id = ? AND event_id = ? LIMIT 1');
  foreach ($items as $it) {
    if (!is_array($it)) continue;
    $ticketId = (int)($it['ticketId'] ?? 0);
    $qty = (int)($it['quantity'] ?? 0);
    if ($ticketId <= 0 || $qty <= 0) json_response(400, ['error' => 'invalid_order_item']);

    $ticketStmt->execute([$ticketId, $eventId]);
    $ticket = $ticketStmt->fetch();
    if (!$ticket) json_response(400, ['error' => 'ticket_not_found']);

    $available = max(0, (int)$ticket['quantity'] - (int)$ticket['sold']);
    if ($qty > $available) {
      json_response(400, [
        'error' => 'ticket_sold_out',
        'message' => 'Not enough tickets available for ' . (string)$ticket['name'],
      ]);
    }

    $priceCents = (int)$ticket['price_cents'];
    $totalCents += ($priceCents * $qty);
    $normalizedItems[] = [
      'ticketId' => (string)$ticketId,
      'name' => (string)$ticket['name'],
      'quantity' => $qty,
      'price' => $priceCents / 100,
    ];
  }
  if (count($normalizedItems) < 1) json_response(400, ['error' => 'invalid_order_items']);
  return ['totalCents' => $totalCents, 'items' => $normalizedItems];
}

function increment_ticket_sold_counts(PDO $pdo, array $normalizedItems): void {
  $inc = $pdo->prepare('UPDATE tickets SET sold = sold + ? WHERE id = ?');
  foreach ($normalizedItems as $it) {
    if (!is_array($it)) continue;
    $tid = (int)($it['ticketId'] ?? 0);
    $qty = (int)($it['quantity'] ?? 0);
    if ($tid > 0 && $qty > 0) $inc->execute([$qty, $tid]);
  }
}

function payhere_amount_matches_order_cents(int $totalCents, string $payhereAmount): bool {
  if ($payhereAmount === '') return false;
  $expected = payhere_amount_format($totalCents / 100.0);
  if ($payhereAmount === $expected) return true;
  return abs(((float)$payhereAmount) - ($totalCents / 100.0)) < 0.02;
}
