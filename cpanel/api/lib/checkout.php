<?php

function map_public_event_row(array $row, ?PDO $pdo = null): array {
  $event = [
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
    'customDomain' => isset($row['custom_domain']) && $row['custom_domain'] !== null && $row['custom_domain'] !== ''
      ? (string)$row['custom_domain']
      : null,
    'status' => $row['status'],
    'createdAt' => gmdate('c', strtotime($row['created_at'])),
  ];

  if ($pdo !== null && function_exists('organizer_profile_api_shape')) {
    $profile = organizer_profile_api_shape($pdo, (int)$row['organizer_user_id']);
    $orgName = trim((string)($profile['organizationName'] ?? ''));
    $displayName = trim((string)($profile['displayName'] ?? ''));
    $event['organizerName'] = $orgName !== '' ? $orgName : ($displayName !== '' ? $displayName : 'Organizer');
    $logo = trim((string)($profile['logoUrl'] ?? ''));
    $event['organizerLogoUrl'] = $logo !== '' ? $logo : null;
    $terms = trim((string)($profile['termsHtml'] ?? ''));
    $event['organizerTermsHtml'] = $terms !== '' ? $terms : null;
  }

  if ($pdo !== null && function_exists('attach_bank_transfer_to_public_event')) {
    $organizerUserId = (int)($row['organizer_user_id'] ?? 0);
    if ($organizerUserId > 0) {
      attach_bank_transfer_to_public_event($event, $pdo, $organizerUserId, $row);
    }
  }

  return $event;
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

function ensure_order_policy_acceptance_columns(PDO $pdo): void {
  static $checked = false;
  if ($checked) return;
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  $cols = [
    'accepted_organizer_terms_at' => $driver === 'pgsql' ? 'TIMESTAMP NULL' : 'DATETIME NULL',
    'accepted_event_policy_at' => $driver === 'pgsql' ? 'TIMESTAMP NULL' : 'DATETIME NULL',
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

function require_checkout_policy_acceptance(array $body): void {
  $acceptedTerms = !empty($body['acceptedOrganizerTerms']);
  $acceptedPolicy = !empty($body['acceptedEventPolicy']);
  if (!$acceptedTerms || !$acceptedPolicy) {
    json_response(400, [
      'error' => 'policy_acceptance_required',
      'message' => 'Please accept the organizer Terms & Conditions and the Event policy to continue.',
    ]);
  }
}

function mark_order_policy_acceptance(PDO $pdo, int $orderId): void {
  ensure_order_policy_acceptance_columns($pdo);
  $stmt = $pdo->prepare(
    'UPDATE orders
     SET accepted_organizer_terms_at = CURRENT_TIMESTAMP,
         accepted_event_policy_at = CURRENT_TIMESTAMP
     WHERE id = ?'
  );
  $stmt->execute([$orderId]);
}

function normalize_order_items_from_db(PDO $pdo, int $eventId, array $items): array {
  ensure_ticket_early_bird_columns($pdo);
  $totalCents = 0;
  $normalizedItems = [];
  $nowTs = time();
  $ticketStmt = $pdo->prepare(
    'SELECT id, name, price_cents, quantity, sold, early_bird_price_cents, early_bird_end_at, early_bird_limit, early_bird_sold, bulk_offers_json
     FROM tickets WHERE id = ? AND event_id = ? LIMIT 1'
  );
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

    $split = ticket_split_early_bird_quantity($ticket, $qty, $nowTs);
    $ticketName = (string)$ticket['name'];

    $bulkOffers = ticket_bulk_offers_from_row($ticket);
    if ($split['earlyBirdQty'] > 0) {
      $ebCents = (int)$ticket['early_bird_price_cents'];
      $earlyLines = ticket_pricing_lines_with_bulk(
        (string)$ticketId,
        $ticketName . ' (Early bird)',
        $split['earlyBirdQty'],
        $ebCents,
        $bulkOffers,
        'early_bird'
      );
      foreach ($earlyLines as $line) {
        $totalCents += (int)($line['lineTotalCents'] ?? 0);
        unset($line['lineTotalCents']);
        $normalizedItems[] = $line;
      }
    }
    if ($split['regularQty'] > 0) {
      $regCents = (int)$ticket['price_cents'];
      $regularLines = ticket_pricing_lines_with_bulk(
        (string)$ticketId,
        $ticketName,
        $split['regularQty'],
        $regCents,
        $bulkOffers,
        'standard'
      );
      foreach ($regularLines as $line) {
        $totalCents += (int)($line['lineTotalCents'] ?? 0);
        unset($line['lineTotalCents']);
        $normalizedItems[] = $line;
      }
    }
  }
  if (count($normalizedItems) < 1) json_response(400, ['error' => 'invalid_order_items']);
  return ['totalCents' => $totalCents, 'items' => $normalizedItems];
}

function ticket_pricing_lines_with_bulk(
  string $ticketId,
  string $baseName,
  int $quantity,
  int $unitPriceCents,
  array $bulkOffers,
  string $pricingTier
): array {
  if ($quantity <= 0) return [];
  if ($bulkOffers === []) {
    return [[
      'ticketId' => $ticketId,
      'name' => $baseName,
      'quantity' => $quantity,
      'price' => $unitPriceCents / 100,
      'lineTotalCents' => $unitPriceCents * $quantity,
      'pricingTier' => $pricingTier,
    ]];
  }

  $offers = [];
  foreach ($bulkOffers as $offer) {
    $qty = (int)($offer['qty'] ?? 0);
    $priceCents = (int)round(((float)($offer['price'] ?? 0)) * 100);
    if ($qty >= 2 && $priceCents > 0) {
      $offers[] = ['qty' => $qty, 'priceCents' => $priceCents];
    }
  }
  if ($offers === []) {
    return [[
      'ticketId' => $ticketId,
      'name' => $baseName,
      'quantity' => $quantity,
      'price' => $unitPriceCents / 100,
      'lineTotalCents' => $unitPriceCents * $quantity,
      'pricingTier' => $pricingTier,
    ]];
  }

  $dp = array_fill(0, $quantity + 1, PHP_INT_MAX);
  $choice = array_fill(0, $quantity + 1, null);
  $dp[0] = 0;

  for ($i = 1; $i <= $quantity; $i++) {
    $single = $dp[$i - 1] + $unitPriceCents;
    if ($single < $dp[$i]) {
      $dp[$i] = $single;
      $choice[$i] = ['qty' => 1, 'priceCents' => $unitPriceCents, 'label' => null];
    }
    foreach ($offers as $offer) {
      if ($offer['qty'] <= $i && $dp[$i - $offer['qty']] !== PHP_INT_MAX) {
        $cost = $dp[$i - $offer['qty']] + $offer['priceCents'];
        if ($cost < $dp[$i]) {
          $dp[$i] = $cost;
          $choice[$i] = ['qty' => $offer['qty'], 'priceCents' => $offer['priceCents'], 'label' => 'bulk'];
        }
      }
    }
  }

  $bucket = [];
  $remaining = $quantity;
  while ($remaining > 0 && is_array($choice[$remaining])) {
    $step = $choice[$remaining];
    $q = (int)$step['qty'];
    $p = (int)$step['priceCents'];
    $key = $q . ':' . $p . ':' . (string)($step['label'] ?? '');
    if (!isset($bucket[$key])) {
      $bucket[$key] = ['qty' => $q, 'priceCents' => $p, 'label' => $step['label'], 'count' => 0];
    }
    $bucket[$key]['count']++;
    $remaining -= $q;
  }

  $lines = [];
  foreach ($bucket as $part) {
    $lineQty = (int)$part['qty'] * (int)$part['count'];
    $unit = (int)round(((int)$part['priceCents']) / (int)$part['qty']);
    $label = $part['label'] === 'bulk' ? " ({$part['qty']} pack)" : '';
    $lines[] = [
      'ticketId' => $ticketId,
      'name' => $baseName . $label,
      'quantity' => $lineQty,
      'price' => $unit / 100,
      'lineTotalCents' => (int)$part['priceCents'] * (int)$part['count'],
      'pricingTier' => $pricingTier,
    ];
  }

  return $lines;
}

function increment_ticket_sold_counts(PDO $pdo, array $normalizedItems): void {
  ensure_ticket_early_bird_columns($pdo);
  $inc = $pdo->prepare('UPDATE tickets SET sold = sold + ? WHERE id = ?');
  $incEarly = $pdo->prepare('UPDATE tickets SET early_bird_sold = early_bird_sold + ? WHERE id = ?');
  foreach ($normalizedItems as $it) {
    if (!is_array($it)) continue;
    $tid = (int)($it['ticketId'] ?? 0);
    $qty = (int)($it['quantity'] ?? 0);
    if ($tid <= 0 || $qty <= 0) continue;
    $inc->execute([$qty, $tid]);
    if (($it['pricingTier'] ?? '') === 'early_bird') {
      $incEarly->execute([$qty, $tid]);
    }
  }
}

/** Release ticket inventory when an attendee registration is removed. */
function decrement_ticket_sold_count(PDO $pdo, int $ticketId, int $qty = 1): void {
  if ($ticketId <= 0 || $qty <= 0) return;
  ensure_ticket_early_bird_columns($pdo);
  $dec = $pdo->prepare('UPDATE tickets SET sold = CASE WHEN sold >= ? THEN sold - ? ELSE 0 END WHERE id = ?');
  $dec->execute([$qty, $qty, $ticketId]);
}

/** Format order total cents as PayHere amount string (e.g. 4300000 → "43000.00"). */
function payhere_amount_format_cents(int $totalCents): string {
  $negative = $totalCents < 0;
  $cents = abs($totalCents);
  return ($negative ? '-' : '') . sprintf('%d.%02d', intdiv($cents, 100), $cents % 100);
}

function payhere_amount_matches_order_cents(int $totalCents, string $payhereAmount): bool {
  if ($payhereAmount === '') return false;
  $expected = payhere_amount_format_cents($totalCents);
  if ($payhereAmount === $expected) return true;
  return abs(((float)$payhereAmount) - ($totalCents / 100.0)) < 0.02;
}
