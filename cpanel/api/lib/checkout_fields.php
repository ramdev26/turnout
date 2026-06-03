<?php

/** @return list<array{id:string,label:string,key:string,required:bool,placeholder?:string}> */
function normalize_checkout_fields(mixed $raw): array {
  if (!is_array($raw)) return [];
  $out = [];
  $seen = [];
  foreach ($raw as $f) {
    if (!is_array($f)) continue;
    $label = trim((string)($f['label'] ?? ''));
    $key = strtolower(trim((string)($f['key'] ?? '')));
    if ($label === '' || $key === '') continue;
    if (!preg_match('/^[a-z][a-z0-9_]{0,31}$/', $key)) continue;
    if (isset($seen[$key])) continue;
    $seen[$key] = true;
    $id = trim((string)($f['id'] ?? ''));
    if ($id === '') $id = 'cf_' . $key;
    $row = [
      'id' => mb_substr($id, 0, 64),
      'label' => mb_substr($label, 0, 80),
      'key' => $key,
      'required' => !empty($f['required']),
    ];
    $placeholder = trim((string)($f['placeholder'] ?? ''));
    if ($placeholder !== '') {
      $row['placeholder'] = mb_substr($placeholder, 0, 120);
    }
    $out[] = $row;
    if (count($out) >= 12) break;
  }
  return $out;
}

/** @return list<array{id:string,label:string,key:string,required:bool,placeholder?:string}> */
function checkout_fields_from_event_row(array $eventRow): array {
  $customization = json_decode((string)($eventRow['customization_json'] ?? ''), true);
  if (!is_array($customization)) return [];
  return normalize_checkout_fields($customization['checkoutFields'] ?? []);
}

function ensure_attendees_custom_fields_column(PDO $pdo): void {
  static $checked = false;
  if ($checked) return;
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  try {
    if ($driver === 'sqlite') {
      $cols = $pdo->query('PRAGMA table_info(attendees)')->fetchAll(PDO::FETCH_ASSOC);
      $has = false;
      foreach ($cols as $c) {
        if (($c['name'] ?? '') === 'custom_fields_json') {
          $has = true;
          break;
        }
      }
      if (!$has) {
        $pdo->exec('ALTER TABLE attendees ADD COLUMN custom_fields_json TEXT NULL');
      }
    } elseif ($driver === 'pgsql') {
      $pdo->exec('ALTER TABLE attendees ADD COLUMN IF NOT EXISTS custom_fields_json JSONB NULL');
    } else {
      $pdo->exec('ALTER TABLE attendees ADD COLUMN custom_fields_json JSON NULL');
    }
  } catch (Throwable $e) {
    // Column may already exist.
  }
  $checked = true;
}

/** @param list<array{id:string,label:string,key:string,required:bool,placeholder?:string}> $checkoutFields */
function validate_attendee_custom_fields(array $checkoutFields, mixed $customFields): void {
  if (count($checkoutFields) < 1) return;
  if (!is_array($customFields)) {
    json_response(400, ['error' => 'missing_custom_fields', 'message' => 'Additional attendee information is required.']);
  }
  foreach ($checkoutFields as $field) {
    $key = (string)($field['key'] ?? '');
    $label = (string)($field['label'] ?? $key);
    $val = trim((string)($customFields[$key] ?? ''));
    if (!empty($field['required']) && $val === '') {
      json_response(400, [
        'error' => 'missing_custom_field',
        'message' => $label . ' is required for each ticket holder.',
        'field' => $key,
      ]);
    }
    if ($val !== '' && mb_strlen($val) > 200) {
      json_response(400, [
        'error' => 'invalid_custom_field',
        'message' => $label . ' is too long (max 200 characters).',
        'field' => $key,
      ]);
    }
  }
}

/** @param list<array{id:string,label:string,key:string,required:bool,placeholder?:string}> $checkoutFields */
function sanitize_attendee_custom_fields(array $checkoutFields, mixed $customFields): ?string {
  if (count($checkoutFields) < 1) return null;
  $src = is_array($customFields) ? $customFields : [];
  $stored = [];
  foreach ($checkoutFields as $field) {
    $key = (string)($field['key'] ?? '');
    if ($key === '') continue;
    $val = trim((string)($src[$key] ?? ''));
    if ($val !== '') $stored[$key] = $val;
  }
  if (count($stored) < 1) return null;
  return json_encode($stored, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

function decode_attendee_custom_fields(mixed $raw): ?array {
  if ($raw === null || $raw === '') return null;
  if (is_array($raw)) return $raw;
  $parsed = json_decode((string)$raw, true);
  return is_array($parsed) ? $parsed : null;
}
