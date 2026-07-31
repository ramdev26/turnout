<?php

/**
 * @return 'text'|'textarea'|'number'|'select'|'radio'
 */
function normalize_checkout_field_type(mixed $raw): string {
  $type = strtolower(trim((string)$raw));
  if (in_array($type, ['text', 'textarea', 'number', 'select', 'radio'], true)) {
    return $type;
  }
  return 'text';
}

/**
 * @return list<array{id:string,label:string,value:string}>
 */
function normalize_checkout_field_options(mixed $raw): array {
  if (!is_array($raw)) return [];
  $out = [];
  $seen = [];
  $optionLabelMax = 120;
  foreach ($raw as $opt) {
    if (!is_array($opt)) continue;
    $label = trim((string)($opt['label'] ?? ''));
    if ($label === '') continue;
    $value = trim((string)($opt['value'] ?? ''));
    if ($value === '') {
      $slug = strtolower(preg_replace('/[^a-z0-9]+/i', '_', $label) ?? '');
      $slug = trim($slug, '_');
      $value = $slug !== '' ? $slug : ('opt_' . (count($out) + 1));
    }
    $value = mb_substr($value, 0, 80);
    if (isset($seen[$value])) continue;
    $seen[$value] = true;
    $id = trim((string)($opt['id'] ?? ''));
    if ($id === '') $id = 'opt_' . $value;
    $out[] = [
      'id' => mb_substr($id, 0, 64),
      'label' => mb_substr($label, 0, $optionLabelMax),
      'value' => $value,
    ];
    if (count($out) >= 24) break;
  }
  return $out;
}

/** @return list<array{id:string,label:string,key:string,required:bool,type:string,placeholder?:string,options?:list<array{id:string,label:string,value:string}>}> */
function normalize_checkout_fields(mixed $raw): array {
  if (!is_array($raw)) return [];
  $out = [];
  $seen = [];
  $labelMax = 240;
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
    $type = normalize_checkout_field_type($f['type'] ?? 'text');
    $row = [
      'id' => mb_substr($id, 0, 64),
      'label' => mb_substr($label, 0, $labelMax),
      'key' => $key,
      'required' => !empty($f['required']),
      'type' => $type,
    ];
    if (in_array($type, ['text', 'textarea', 'number'], true)) {
      $placeholder = trim((string)($f['placeholder'] ?? ''));
      if ($placeholder !== '') {
        $row['placeholder'] = mb_substr($placeholder, 0, 120);
      }
    }
    if ($type === 'select' || $type === 'radio') {
      $options = normalize_checkout_field_options($f['options'] ?? []);
      if (count($options) < 1) continue;
      $row['options'] = $options;
    }
    $out[] = $row;
    if (count($out) >= 12) break;
  }
  return $out;
}

/** @return list<array{id:string,label:string,key:string,required:bool,type:string,placeholder?:string,options?:list<array{id:string,label:string,value:string}>}> */
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

/** @param list<array{id:string,label:string,key:string,required:bool,type?:string,options?:list<array{id:string,label:string,value:string}>}> $checkoutFields */
function validate_attendee_custom_fields(array $checkoutFields, mixed $customFields): void {
  if (count($checkoutFields) < 1) return;
  if (!is_array($customFields)) {
    json_response(400, ['error' => 'missing_custom_fields', 'message' => 'Additional attendee information is required.']);
  }
  foreach ($checkoutFields as $field) {
    $key = (string)($field['key'] ?? '');
    $label = (string)($field['label'] ?? $key);
    $type = normalize_checkout_field_type($field['type'] ?? 'text');
    $val = trim((string)($customFields[$key] ?? ''));
    if (!empty($field['required']) && $val === '') {
      json_response(400, [
        'error' => 'missing_custom_field',
        'message' => $label . ' is required for each ticket holder.',
        'field' => $key,
      ]);
    }
    if ($val === '') continue;

    $maxLen = $type === 'textarea' ? 2000 : 200;
    if (mb_strlen($val) > $maxLen) {
      json_response(400, [
        'error' => 'invalid_custom_field',
        'message' => $label . ' is too long (max ' . $maxLen . ' characters).',
        'field' => $key,
      ]);
    }

    if ($type === 'number' && !preg_match('/^-?\d+(\.\d+)?$/', $val)) {
      json_response(400, [
        'error' => 'invalid_custom_field',
        'message' => $label . ' must be a valid number.',
        'field' => $key,
      ]);
    }

    if ($type === 'select' || $type === 'radio') {
      $allowed = [];
      foreach (($field['options'] ?? []) as $opt) {
        if (!is_array($opt)) continue;
        $allowed[(string)($opt['value'] ?? '')] = true;
      }
      if ($allowed !== [] && !isset($allowed[$val])) {
        json_response(400, [
          'error' => 'invalid_custom_field',
          'message' => 'Please choose a valid option for ' . $label . '.',
          'field' => $key,
        ]);
      }
    }
  }
}

/** @param list<array{id:string,label:string,key:string,required:bool,type?:string,placeholder?:string,options?:list}> $checkoutFields */
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
