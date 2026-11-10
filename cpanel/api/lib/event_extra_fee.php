<?php

/**
 * Per-event buyer-facing extra fee (tax / service charge).
 * Organizers set a custom label plus percent or fixed LKR amount in event customization.
 */

function ensure_order_extra_fee_columns(PDO $pdo): void {
  static $checked = false;
  if ($checked) return;
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  $cols = [
    'extra_fee_cents' => $driver === 'pgsql'
      ? 'INT NOT NULL DEFAULT 0'
      : ($driver === 'sqlite' ? 'INTEGER NOT NULL DEFAULT 0' : 'INT NOT NULL DEFAULT 0'),
    'extra_fee_label' => $driver === 'pgsql'
      ? 'VARCHAR(80) NULL'
      : ($driver === 'sqlite' ? 'TEXT NULL' : 'VARCHAR(80) NULL'),
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

/**
 * @return array{enabled:bool,label:string,type:'percent'|'fixed',value:float}
 */
function normalize_event_extra_fee_config(mixed $raw): array {
  $defaults = [
    'enabled' => false,
    'label' => 'Tax',
    'type' => 'percent',
    'value' => 0.0,
  ];
  if (!is_array($raw)) {
    return $defaults;
  }

  $label = trim((string)($raw['label'] ?? 'Tax'));
  if ($label === '') $label = 'Tax';
  if (function_exists('mb_substr')) {
    $label = mb_substr($label, 0, 60);
  } else {
    $label = substr($label, 0, 60);
  }

  $type = strtolower(trim((string)($raw['type'] ?? 'percent')));
  if ($type !== 'fixed') $type = 'percent';

  $value = (float)($raw['value'] ?? 0);
  if ($value < 0) $value = 0;
  if ($type === 'percent') {
    if ($value > 100) $value = 100;
    $value = round($value, 2);
  } else {
    // Fixed amount in LKR (not cents). Cap at a sane upper bound.
    if ($value > 1000000) $value = 1000000;
    $value = round($value, 2);
  }

  $enabled = !empty($raw['enabled']) && $value > 0;

  return [
    'enabled' => $enabled,
    'label' => $label,
    'type' => $type,
    'value' => $value,
  ];
}

/**
 * Read fee config from an event row or customization array.
 *
 * @return array{enabled:bool,label:string,type:'percent'|'fixed',value:float}
 */
function event_extra_fee_from_event(array $eventOrCustomization): array {
  $customization = null;
  if (isset($eventOrCustomization['customization_json'])) {
    $decoded = json_decode((string)$eventOrCustomization['customization_json'], true);
    $customization = is_array($decoded) ? $decoded : [];
  } elseif (isset($eventOrCustomization['customization']) && is_array($eventOrCustomization['customization'])) {
    $customization = $eventOrCustomization['customization'];
  } elseif (isset($eventOrCustomization['extraFee']) || isset($eventOrCustomization['enabled'])) {
    // Already a customization / fee object.
    if (isset($eventOrCustomization['extraFee'])) {
      return normalize_event_extra_fee_config($eventOrCustomization['extraFee']);
    }
    return normalize_event_extra_fee_config($eventOrCustomization);
  } else {
    $customization = $eventOrCustomization;
  }

  return normalize_event_extra_fee_config($customization['extraFee'] ?? null);
}

/**
 * Compute fee cents on a post-discount subtotal.
 *
 * @param array{enabled:bool,label:string,type:'percent'|'fixed',value:float} $config
 * @return array{extraFeeCents:int,label:string,type:string,value:float}
 */
function compute_event_extra_fee_cents(int $baseCents, array $config): array {
  $baseCents = max(0, $baseCents);
  $config = normalize_event_extra_fee_config($config);
  $label = (string)$config['label'];
  $type = (string)$config['type'];
  $value = (float)$config['value'];

  if (!$config['enabled'] || $baseCents <= 0 || $value <= 0) {
    return [
      'extraFeeCents' => 0,
      'label' => $label,
      'type' => $type,
      'value' => $value,
    ];
  }

  if ($type === 'fixed') {
    $feeCents = (int)round($value * 100);
  } else {
    $feeCents = (int)round($baseCents * ($value / 100.0));
  }
  if ($feeCents < 0) $feeCents = 0;

  return [
    'extraFeeCents' => $feeCents,
    'label' => $label,
    'type' => $type,
    'value' => $value,
  ];
}

/**
 * @return array{extraFeeCents:int,label:string,type:string,value:float,totalCents:int}
 */
function apply_event_extra_fee_cents(array $eventRow, int $afterDiscountCents): array {
  $config = event_extra_fee_from_event($eventRow);
  $fee = compute_event_extra_fee_cents($afterDiscountCents, $config);
  return [
    'extraFeeCents' => (int)$fee['extraFeeCents'],
    'label' => (string)$fee['label'],
    'type' => (string)$fee['type'],
    'value' => (float)$fee['value'],
    'totalCents' => max(0, $afterDiscountCents) + (int)$fee['extraFeeCents'],
  ];
}

function attach_extra_fee_to_order(PDO $pdo, int $orderId, int $extraFeeCents, string $label): void {
  if ($orderId <= 0) return;
  ensure_order_extra_fee_columns($pdo);
  $extraFeeCents = max(0, $extraFeeCents);
  $label = trim($label);
  if ($label === '') $label = 'Tax';
  if (function_exists('mb_substr')) {
    $label = mb_substr($label, 0, 80);
  } else {
    $label = substr($label, 0, 80);
  }
  $stmt = $pdo->prepare('UPDATE orders SET extra_fee_cents = ?, extra_fee_label = ? WHERE id = ?');
  $stmt->execute([$extraFeeCents, $extraFeeCents > 0 ? $label : null, $orderId]);
}

/**
 * Sanitize organizer-submitted fee config for customization_json.
 *
 * @return array{enabled:bool,label:string,type:'percent'|'fixed',value:float}|null
 *   null means clear / disable the fee block.
 */
function sanitize_event_extra_fee_for_customization(mixed $raw): ?array {
  if ($raw === null) {
    return null;
  }
  if (!is_array($raw)) {
    return null;
  }
  $normalized = normalize_event_extra_fee_config($raw);
  // Persist even when disabled so organizers keep their draft settings.
  $enabledFlag = !empty($raw['enabled']);
  return [
    'enabled' => $enabledFlag && $normalized['value'] > 0,
    'label' => $normalized['label'],
    'type' => $normalized['type'],
    'value' => $normalized['value'],
  ];
}
