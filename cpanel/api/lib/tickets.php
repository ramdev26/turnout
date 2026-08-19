<?php

/**
 * Ticket tiers — early bird pricing helpers.
 */

function ensure_ticket_early_bird_columns(PDO $pdo): void {
  static $checked = false;
  if ($checked) return;
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);

  $columns = [
    'early_bird_price_cents' => $driver === 'pgsql' ? 'INTEGER NULL' : 'INT NULL',
    'early_bird_end_at' => $driver === 'pgsql' ? 'TIMESTAMP NULL' : ($driver === 'sqlite' ? 'TEXT NULL' : 'DATETIME NULL'),
    'early_bird_limit' => $driver === 'pgsql' ? 'INTEGER NULL' : 'INT NULL',
    'early_bird_sold' => $driver === 'pgsql' ? 'INTEGER NOT NULL DEFAULT 0' : 'INT NOT NULL DEFAULT 0',
  ];

  if ($driver === 'sqlite') {
    foreach ($columns as $name => $type) {
      try {
        $pdo->exec("ALTER TABLE tickets ADD COLUMN {$name} " . ($name === 'early_bird_sold' ? 'INTEGER NOT NULL DEFAULT 0' : 'TEXT NULL'));
      } catch (Throwable $e) {
        // Column may already exist.
      }
    }
    $checked = true;
    return;
  }

  if ($driver === 'pgsql') {
    foreach ($columns as $name => $type) {
      try {
        $pdo->exec("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS {$name} {$type}");
      } catch (Throwable $e) {
        // Ignore migration errors.
      }
    }
    $checked = true;
    return;
  }

  foreach ($columns as $name => $type) {
    try {
      $pdo->exec("ALTER TABLE tickets ADD COLUMN {$name} {$type}");
    } catch (Throwable $e) {
      // Column may already exist.
    }
  }
  $checked = true;
}

function parse_early_bird_enabled_from_body(array $body): bool {
  if (array_key_exists('earlyBirdEnabled', $body)) {
    return !empty($body['earlyBirdEnabled']);
  }
  if (array_key_exists('earlyBird', $body) && is_array($body['earlyBird'])) {
    return !empty($body['earlyBird']['enabled']);
  }
  return array_key_exists('earlyBirdPrice', $body)
    || array_key_exists('earlyBirdEndAt', $body)
    || array_key_exists('earlyBirdLimit', $body);
}

function parse_early_bird_fields_from_body(array $body): array {
  $enabled = parse_early_bird_enabled_from_body($body);
  $src = (array_key_exists('earlyBird', $body) && is_array($body['earlyBird'])) ? $body['earlyBird'] : $body;

  if (!$enabled) {
    return [
      'enabled' => false,
      'priceCents' => null,
      'endAt' => null,
      'limit' => null,
    ];
  }

  $price = isset($src['earlyBirdPrice']) ? (float)$src['earlyBirdPrice'] : (isset($src['price']) ? (float)$src['price'] : null);
  $endAtRaw = trim((string)($src['earlyBirdEndAt'] ?? $src['endAt'] ?? ''));
  $limit = isset($src['earlyBirdLimit']) ? (int)$src['earlyBirdLimit'] : (isset($src['limit']) ? (int)$src['limit'] : null);

  $endAt = null;
  if ($endAtRaw !== '') {
    $ts = strtotime($endAtRaw);
    if ($ts === false) {
      json_response(400, ['error' => 'invalid_early_bird_end_at', 'message' => 'Early bird end date is invalid.']);
    }
    $endAt = date('Y-m-d H:i:s', $ts);
  }

  return [
    'enabled' => true,
    'priceCents' => $price !== null ? (int)round($price * 100) : null,
    'endAt' => $endAt,
    'limit' => $limit,
  ];
}

function validate_ticket_early_bird(float $regularPrice, array $earlyBird, int $quantity, int $existingEarlyBirdSold = 0): void {
  if (empty($earlyBird['enabled'])) return;

  $priceCents = $earlyBird['priceCents'] ?? null;
  $endAt = $earlyBird['endAt'] ?? null;
  $limit = $earlyBird['limit'] ?? null;

  if ($priceCents === null || $endAt === null || $limit === null) {
    json_response(400, [
      'error' => 'incomplete_early_bird',
      'message' => 'Early bird pricing needs a rate, end date, and ticket limit.',
    ]);
  }

  if ($regularPrice <= 0) {
    json_response(400, [
      'error' => 'early_bird_requires_paid_tier',
      'message' => 'Early bird pricing is only available on paid ticket tiers.',
    ]);
  }

  if ($priceCents < 0) {
    json_response(400, ['error' => 'invalid_early_bird_price']);
  }
  if ($priceCents >= (int)round($regularPrice * 100)) {
    json_response(400, [
      'error' => 'early_bird_price_too_high',
      'message' => 'Early bird price must be lower than the standard price.',
    ]);
  }
  if ($limit < 1) {
    json_response(400, ['error' => 'invalid_early_bird_limit']);
  }
  if ($limit > $quantity) {
    json_response(400, [
      'error' => 'early_bird_limit_exceeds_quantity',
      'message' => 'Early bird limit cannot exceed total tier capacity.',
    ]);
  }
  if ($limit < $existingEarlyBirdSold) {
    json_response(400, [
      'error' => 'early_bird_limit_below_sold',
      'message' => 'Early bird limit cannot be below tickets already sold at the early bird rate.',
    ]);
  }
}

function ticket_early_bird_remaining(array $ticketRow): int {
  if (!ticket_early_bird_configured($ticketRow)) return 0;
  return max(0, (int)$ticketRow['early_bird_limit'] - (int)($ticketRow['early_bird_sold'] ?? 0));
}

function ticket_early_bird_configured(array $ticketRow): bool {
  $priceCents = $ticketRow['early_bird_price_cents'] ?? null;
  $endAt = trim((string)($ticketRow['early_bird_end_at'] ?? ''));
  $limit = $ticketRow['early_bird_limit'] ?? null;
  return $priceCents !== null && (int)$priceCents >= 0 && $endAt !== '' && $limit !== null && (int)$limit > 0;
}

function ticket_early_bird_active(array $ticketRow, ?int $nowTs = null): bool {
  if (!ticket_early_bird_configured($ticketRow)) return false;
  $nowTs = $nowTs ?? time();
  $endTs = strtotime((string)$ticketRow['early_bird_end_at']);
  if ($endTs === false || $nowTs > $endTs) return false;
  return ticket_early_bird_remaining($ticketRow) > 0;
}

function ticket_effective_price_cents(array $ticketRow, ?int $nowTs = null): int {
  if (ticket_early_bird_active($ticketRow, $nowTs)) {
    return (int)$ticketRow['early_bird_price_cents'];
  }
  return (int)$ticketRow['price_cents'];
}

/** Split a purchase quantity into early-bird vs standard-priced units. */
function ticket_split_early_bird_quantity(array $ticketRow, int $qty, ?int $nowTs = null): array {
  $earlyQty = 0;
  if ($qty > 0 && ticket_early_bird_active($ticketRow, $nowTs)) {
    $earlyQty = min($qty, ticket_early_bird_remaining($ticketRow));
  }
  return [
    'earlyBirdQty' => $earlyQty,
    'regularQty' => max(0, $qty - $earlyQty),
  ];
}

function ticket_early_bird_api_fields(array $row, ?int $nowTs = null): ?array {
  if (!ticket_early_bird_configured($row)) return null;
  $active = ticket_early_bird_active($row, $nowTs);
  $endAt = trim((string)($row['early_bird_end_at'] ?? ''));
  return [
    'price' => ((int)$row['early_bird_price_cents']) / 100,
    'endAt' => $endAt !== '' ? gmdate('c', strtotime($endAt)) : null,
    'limit' => (int)$row['early_bird_limit'],
    'sold' => (int)($row['early_bird_sold'] ?? 0),
    'remaining' => ticket_early_bird_remaining($row),
    'active' => $active,
  ];
}

function ticket_to_api_shape(array $row, ?int $nowTs = null): array {
  $effectiveCents = ticket_effective_price_cents($row, $nowTs);
  $shape = [
    'id' => (string)$row['id'],
    'eventId' => (string)$row['event_id'],
    'name' => $row['name'],
    'price' => ((int)$row['price_cents']) / 100,
    'effectivePrice' => $effectiveCents / 100,
    'quantity' => (int)$row['quantity'],
    'sold' => (int)$row['sold'],
    'description' => $row['description'],
  ];
  $eb = ticket_early_bird_api_fields($row, $nowTs);
  if ($eb !== null) {
    $shape['earlyBird'] = $eb;
  }
  return $shape;
}

function ticket_early_bird_db_values(array $earlyBird): array {
  if (empty($earlyBird['enabled'])) {
    return [null, null, null];
  }
  return [
    $earlyBird['priceCents'],
    $earlyBird['endAt'],
    $earlyBird['limit'],
  ];
}

/** @param list<array<string, mixed>> $tickets */
function tickets_include_paid_or_early_bird_price(array $tickets): bool {
  foreach ($tickets as $ticket) {
    if (!is_array($ticket)) continue;
    $price = array_key_exists('price', $ticket)
      ? (float)$ticket['price']
      : ((int)($ticket['price_cents'] ?? 0) / 100);
    if ($price > 0) return true;
    $eb = $ticket['earlyBird'] ?? null;
    if (is_array($eb) && (float)($eb['price'] ?? 0) > 0) return true;
    if (array_key_exists('earlyBirdPrice', $ticket) && (float)$ticket['earlyBirdPrice'] > 0) return true;
    if (!empty($ticket['earlyBirdEnabled']) && isset($ticket['earlyBirdPrice']) && (float)$ticket['earlyBirdPrice'] > 0) {
      return true;
    }
  }
  return false;
}
