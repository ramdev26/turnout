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

function ensure_ticket_sales_rule_columns(PDO $pdo): void {
  static $checked = false;
  if ($checked) return;
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  $cols = [
    'sales_ends_at' => $driver === 'pgsql' ? 'TIMESTAMP NULL' : 'DATETIME NULL',
    'max_per_attendee' => 'INTEGER NULL',
  ];
  foreach ($cols as $name => $type) {
    try {
      if ($driver === 'pgsql') {
        $pdo->exec("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS {$name} {$type}");
      } else {
        $pdo->exec("ALTER TABLE tickets ADD COLUMN {$name} {$type}");
      }
    } catch (Throwable $e) {
      // Column may already exist.
    }
  }
  $checked = true;
}

function ticket_api_shape(array $row): array {
  $salesEnds = $row['sales_ends_at'] ?? null;
  $maxPer = $row['max_per_attendee'] ?? null;
  return [
    'id' => (string)$row['id'],
    'eventId' => (string)$row['event_id'],
    'name' => $row['name'],
    'price' => ((int)$row['price_cents']) / 100,
    'quantity' => (int)$row['quantity'],
    'sold' => (int)($row['sold'] ?? 0),
    'description' => $row['description'] ?? null,
    'salesEndsAt' => $salesEnds !== null && $salesEnds !== ''
      ? gmdate('c', strtotime((string)$salesEnds))
      : null,
    'maxPerAttendee' => $maxPer !== null && $maxPer !== '' ? (int)$maxPer : null,
  ];
}

/** @return array{salesEndsAt:?string,maxPerAttendee:?int} */
function parse_ticket_sales_rules_from_body(array $body): array {
  $salesRaw = trim((string)($body['salesEndsAt'] ?? ''));
  $salesEndsAt = null;
  if ($salesRaw !== '') {
    $ts = strtotime($salesRaw);
    if ($ts === false) {
      json_response(400, ['error' => 'invalid_sales_ends_at', 'message' => 'Enter a valid sales end date.']);
    }
    $salesEndsAt = gmdate('Y-m-d H:i:s', $ts);
  }

  $maxPerAttendee = null;
  if (array_key_exists('maxPerAttendee', $body) && $body['maxPerAttendee'] !== null && $body['maxPerAttendee'] !== '') {
    $maxPerAttendee = (int)$body['maxPerAttendee'];
    if ($maxPerAttendee < 1) {
      json_response(400, [
        'error' => 'invalid_max_per_attendee',
        'message' => 'Per-attendee limit must be at least 1, or leave empty for no limit.',
      ]);
    }
  }

  return ['salesEndsAt' => $salesEndsAt, 'maxPerAttendee' => $maxPerAttendee];
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
  ensure_ticket_sales_rule_columns($pdo);
  $totalCents = 0;
  $normalizedItems = [];
  $ticketStmt = $pdo->prepare(
    'SELECT id, name, price_cents, quantity, sold, sales_ends_at, max_per_attendee
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

    $salesEnds = $ticket['sales_ends_at'] ?? null;
    if ($salesEnds !== null && $salesEnds !== '') {
      $endsTs = strtotime((string)$salesEnds);
      if ($endsTs !== false && $endsTs <= time()) {
        json_response(400, [
          'error' => 'ticket_sales_ended',
          'message' => 'Sales have ended for ' . (string)$ticket['name'],
        ]);
      }
    }

    $maxPer = $ticket['max_per_attendee'] ?? null;
    if ($maxPer !== null && $maxPer !== '' && $qty > (int)$maxPer) {
      json_response(400, [
        'error' => 'ticket_attendee_limit',
        'message' => 'You can buy at most ' . (int)$maxPer . ' of ' . (string)$ticket['name'] . ' per order.',
      ]);
    }

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
