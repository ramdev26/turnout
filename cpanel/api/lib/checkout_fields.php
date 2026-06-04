<?php

/** @return list<array{id:string,label:string,key:string,required:bool,placeholder?:string,type?:string,options?:list<string>,showWhen?:array{fieldKey:string,values:list<string>}}> */
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
    $type = trim((string)($f['type'] ?? 'text'));
    if (!in_array($type, ['text', 'date', 'tel', 'select'], true)) $type = 'text';
    $row = [
      'id' => mb_substr($id, 0, 64),
      'label' => mb_substr($label, 0, 80),
      'key' => $key,
      'required' => !empty($f['required']),
      'type' => $type,
    ];
    $placeholder = trim((string)($f['placeholder'] ?? ''));
    if ($placeholder !== '') {
      $row['placeholder'] = mb_substr($placeholder, 0, 120);
    }
    if ($type === 'select' && is_array($f['options'] ?? null)) {
      $opts = [];
      foreach ($f['options'] as $opt) {
        $o = trim((string)$opt);
        if ($o !== '') $opts[] = mb_substr($o, 0, 80);
      }
      if (count($opts) < 1) continue;
      $row['options'] = array_slice($opts, 0, 24);
    }
    if (is_array($f['showWhen'] ?? null)) {
      $depKey = strtolower(trim((string)($f['showWhen']['fieldKey'] ?? '')));
      $vals = [];
      if (is_array($f['showWhen']['values'] ?? null)) {
        foreach ($f['showWhen']['values'] as $v) {
          $t = trim((string)$v);
          if ($t !== '') $vals[] = $t;
        }
      }
      if ($depKey !== '' && count($vals) > 0) {
        $row['showWhen'] = ['fieldKey' => $depKey, 'values' => $vals];
      }
    }
    $out[] = $row;
    if (count($out) >= 12) break;
  }
  return $out;
}

/** @return array<string, mixed> */
function normalize_checkout_field_presets(mixed $raw): array {
  $defaults = [
    'dateOfBirth' => false,
    'emergencyContactName' => false,
    'emergencyContactPhone' => false,
    'duprRating' => false,
    'eventCategory' => false,
    'partnerName' => false,
    'partnerPhone' => false,
    'eventCategoryOptions' => [],
    'doublesCategoryValues' => [],
  ];
  if (!is_array($raw)) return $defaults;
  $ids = [
    'dateOfBirth', 'emergencyContactName', 'emergencyContactPhone', 'duprRating',
    'eventCategory', 'partnerName', 'partnerPhone',
  ];
  foreach ($ids as $id) {
    if (array_key_exists($id, $raw)) {
      $defaults[$id] = (bool)$raw[$id];
    }
  }
  if (is_array($raw['eventCategoryOptions'] ?? null)) {
    $opts = [];
    foreach ($raw['eventCategoryOptions'] as $o) {
      $t = trim((string)$o);
      if ($t !== '') $opts[] = mb_substr($t, 0, 80);
    }
    $defaults['eventCategoryOptions'] = array_slice($opts, 0, 24);
  }
  if (is_array($raw['doublesCategoryValues'] ?? null)) {
    $opts = [];
    foreach ($raw['doublesCategoryValues'] as $o) {
      $t = trim((string)$o);
      if ($t !== '') $opts[] = mb_substr($t, 0, 80);
    }
    $defaults['doublesCategoryValues'] = array_slice($opts, 0, 24);
  }
  return $defaults;
}

/** @param array<string, mixed> $presets */
function checkout_preset_field_definitions(array $presets): array {
  $categoryOptions = $presets['eventCategoryOptions'] ?? [];
  if (!is_array($categoryOptions)) $categoryOptions = [];
  $doublesValues = $presets['doublesCategoryValues'] ?? [];
  if (!is_array($doublesValues) || count($doublesValues) < 1) {
    $doublesValues = [];
    foreach ($categoryOptions as $opt) {
      if (is_string($opt) && stripos($opt, 'double') !== false) {
        $doublesValues[] = $opt;
      }
    }
  }
  $showWhenDoubles = count($doublesValues) > 0
    ? ['fieldKey' => 'event_category', 'values' => array_values($doublesValues)]
    : null;

  $built = [];
  if (!empty($presets['dateOfBirth'])) {
    $built[] = ['id' => 'preset_date_of_birth', 'key' => 'date_of_birth', 'label' => 'Date of birth', 'type' => 'date', 'required' => true];
  }
  if (!empty($presets['emergencyContactName'])) {
    $built[] = ['id' => 'preset_emergency_contact_name', 'key' => 'emergency_contact_name', 'label' => 'Emergency contact name', 'type' => 'text', 'required' => true, 'placeholder' => 'Full name'];
  }
  if (!empty($presets['emergencyContactPhone'])) {
    $built[] = ['id' => 'preset_emergency_contact_phone', 'key' => 'emergency_contact_phone', 'label' => 'Emergency contact number', 'type' => 'tel', 'required' => true, 'placeholder' => '+94 …'];
  }
  if (!empty($presets['duprRating'])) {
    $built[] = ['id' => 'preset_dupr_rating', 'key' => 'dupr_rating', 'label' => 'DUPR rating (if available)', 'type' => 'text', 'required' => false, 'placeholder' => 'e.g. 4.25'];
  }
  if (!empty($presets['eventCategory']) && count($categoryOptions) > 0) {
    $built[] = ['id' => 'preset_event_category', 'key' => 'event_category', 'label' => 'Event category', 'type' => 'select', 'required' => true, 'options' => array_values($categoryOptions)];
  }
  if (!empty($presets['partnerName']) && $showWhenDoubles !== null) {
    $built[] = ['id' => 'preset_partner_name', 'key' => 'partner_name', 'label' => 'Partner name', 'type' => 'text', 'required' => true, 'showWhen' => $showWhenDoubles];
  }
  if (!empty($presets['partnerPhone']) && $showWhenDoubles !== null) {
    $built[] = ['id' => 'preset_partner_phone', 'key' => 'partner_phone', 'label' => "Partner's contact number", 'type' => 'tel', 'required' => true, 'showWhen' => $showWhenDoubles];
  }
  return $built;
}

/** @return list<array{id:string,label:string,key:string,required:bool,placeholder?:string,type?:string,options?:list<string>,showWhen?:array}> */
function checkout_fields_from_customization(array $customization): array {
  $presets = normalize_checkout_field_presets($customization['checkoutFieldPresets'] ?? null);
  $presetFields = checkout_preset_field_definitions($presets);
  $custom = normalize_checkout_fields($customization['checkoutFields'] ?? []);
  $seen = [];
  $merged = [];
  foreach ($presetFields as $f) {
    $seen[$f['key']] = true;
    $merged[] = $f;
  }
  foreach ($custom as $f) {
    if (isset($seen[$f['key']])) continue;
    $seen[$f['key']] = true;
    $merged[] = $f;
  }
  return array_slice($merged, 0, 20);
}

/** @return list<array{id:string,label:string,key:string,required:bool,placeholder?:string,type?:string,options?:list<string>,showWhen?:array}> */
function checkout_fields_from_event_row(array $eventRow): array {
  $customization = json_decode((string)($eventRow['customization_json'] ?? ''), true);
  if (!is_array($customization)) return [];
  return checkout_fields_from_customization($customization);
}

function checkout_field_is_visible(array $field, array $values): bool {
  $showWhen = $field['showWhen'] ?? null;
  if (!is_array($showWhen)) return true;
  $depKey = (string)($showWhen['fieldKey'] ?? '');
  $vals = $showWhen['values'] ?? [];
  if ($depKey === '' || !is_array($vals) || count($vals) < 1) return true;
  $current = trim((string)($values[$depKey] ?? ''));
  return in_array($current, $vals, true);
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

/** @param list<array{id:string,label:string,key:string,required:bool,placeholder?:string,type?:string,options?:list<string>,showWhen?:array}> $checkoutFields */
function validate_attendee_custom_fields(array $checkoutFields, mixed $customFields): void {
  if (count($checkoutFields) < 1) return;
  if (!is_array($customFields)) {
    json_response(400, ['error' => 'missing_custom_fields', 'message' => 'Additional attendee information is required.']);
  }
  foreach ($checkoutFields as $field) {
    if (!checkout_field_is_visible($field, $customFields)) continue;
    $key = (string)($field['key'] ?? '');
    $label = (string)($field['label'] ?? $key);
    $val = trim((string)($customFields[$key] ?? ''));
    $type = (string)($field['type'] ?? 'text');
    if ($type === 'select' && is_array($field['options'] ?? null) && $val !== '') {
      if (!in_array($val, $field['options'], true)) {
        json_response(400, [
          'error' => 'invalid_custom_field',
          'message' => $label . ' must be one of the listed options.',
          'field' => $key,
        ]);
      }
    }
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

/** @param list<array{id:string,label:string,key:string,required:bool,placeholder?:string,type?:string,options?:list<string>,showWhen?:array}> $checkoutFields */
function sanitize_attendee_custom_fields(array $checkoutFields, mixed $customFields): ?string {
  if (count($checkoutFields) < 1) return null;
  $src = is_array($customFields) ? $customFields : [];
  $stored = [];
  foreach ($checkoutFields as $field) {
    if (!checkout_field_is_visible($field, $src)) continue;
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
