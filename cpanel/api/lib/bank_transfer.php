<?php

/**
 * Bank transfer checkout: organizer receiving account + slip upload + confirm.
 */

function ensure_order_bank_transfer_columns(PDO $pdo): void {
  static $checked = false;
  if ($checked) return;
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  $cols = [
    'payment_method' => $driver === 'pgsql' ? 'VARCHAR(32) NULL' : 'VARCHAR(32) NULL',
    'bank_transfer_slip_url' => $driver === 'pgsql' ? 'TEXT NULL' : 'TEXT NULL',
    'bank_transfer_slip_uploaded_at' => $driver === 'pgsql' ? 'TIMESTAMP NULL' : 'DATETIME NULL',
    'bank_transfer_confirmed_at' => $driver === 'pgsql' ? 'TIMESTAMP NULL' : 'DATETIME NULL',
    'bank_transfer_confirmed_by' => $driver === 'pgsql' ? 'INTEGER NULL' : 'INT NULL',
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

/** Four account fields only (statement not required for receiving transfers). */
function organizer_receiving_bank_complete(array $profileRow): bool {
  return trim((string)($profileRow['bank_account_holder_name'] ?? '')) !== ''
    && trim((string)($profileRow['bank_name'] ?? '')) !== ''
    && trim((string)($profileRow['bank_branch'] ?? '')) !== ''
    && trim((string)($profileRow['bank_account_number'] ?? '')) !== '';
}

function organizer_receiving_bank_api_shape(array $profileRow): ?array {
  if (!organizer_receiving_bank_complete($profileRow)) {
    return null;
  }
  return [
    'accountHolderName' => trim((string)$profileRow['bank_account_holder_name']),
    'bankName' => trim((string)$profileRow['bank_name']),
    'bankBranch' => trim((string)$profileRow['bank_branch']),
    'accountNumber' => trim((string)$profileRow['bank_account_number']),
  ];
}

function event_payment_methods_from_customization(?array $customization): array {
  if (!is_array($customization)) $customization = [];
  $pm = $customization['paymentMethods'] ?? null;
  if (!is_array($pm)) $pm = [];

  // PayHere defaults ON when unset (backward compatible).
  $payhere = array_key_exists('payhere', $pm) ? !empty($pm['payhere']) : true;
  if (array_key_exists('allowPayhere', $customization)) {
    $payhere = !empty($customization['allowPayhere']);
  }

  $bank = !empty($customization['allowBankTransfer']) || !empty($pm['bankTransfer']);

  return [
    'payhere' => (bool)$payhere,
    'bankTransfer' => (bool)$bank,
  ];
}

function event_allows_bank_transfer(array $eventRow): bool {
  $customization = json_decode((string)($eventRow['customization_json'] ?? ''), true);
  $methods = event_payment_methods_from_customization(is_array($customization) ? $customization : []);
  return !empty($methods['bankTransfer']);
}

function event_allows_payhere(array $eventRow): bool {
  $customization = json_decode((string)($eventRow['customization_json'] ?? ''), true);
  $methods = event_payment_methods_from_customization(is_array($customization) ? $customization : []);
  return !empty($methods['payhere']);
}

function apply_event_payment_methods_to_customization(array $customization, bool $payhere, bool $bankTransfer): array {
  $customization['paymentMethods'] = [
    'payhere' => $payhere,
    'bankTransfer' => $bankTransfer,
  ];
  $customization['allowPayhere'] = $payhere;
  if ($bankTransfer) {
    $customization['allowBankTransfer'] = true;
  } else {
    unset($customization['allowBankTransfer']);
  }
  return $customization;
}

function bank_transfer_slips_local_upload_dir(): ?string {
  $preferred = dirname(__DIR__) . '/uploads/bank-transfer-slips';
  if (is_dir($preferred) && is_writable($preferred)) {
    return $preferred;
  }
  if (!is_dir($preferred)) {
    @mkdir($preferred, 0775, true);
  }
  if (is_dir($preferred) && is_writable($preferred)) {
    return $preferred;
  }
  $tmp = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'turnout-bank-slips';
  if (!is_dir($tmp)) {
    @mkdir($tmp, 0775, true);
  }
  return is_dir($tmp) && is_writable($tmp) ? $tmp : null;
}

function save_bank_transfer_slip_locally(string $tmpPath, string $ext): ?string {
  $dir = bank_transfer_slips_local_upload_dir();
  if ($dir === null) return null;
  $name = 'slip_' . bin2hex(random_bytes(12)) . '.' . $ext;
  $dest = $dir . DIRECTORY_SEPARATOR . $name;
  if (!@move_uploaded_file($tmpPath, $dest) && !@rename($tmpPath, $dest)) {
    if (!@copy($tmpPath, $dest)) {
      return null;
    }
    @unlink($tmpPath);
  }
  return $name;
}

function try_upload_bank_transfer_slip_to_vercel_blob(string $filePath, string $mime, string $ext): ?string {
  $token = trim((string)(getenv('BLOB_READ_WRITE_TOKEN') ?: ''));
  if ($token === '' || !function_exists('curl_init')) {
    return null;
  }
  $storeId = trim((string)(getenv('BLOB_STORE_ID') ?: ''));
  if ($storeId === '') {
    $storeId = parse_blob_store_id_from_token($token);
  }
  if ($storeId !== '' && str_starts_with($storeId, 'store_')) {
    $storeId = substr($storeId, strlen('store_'));
  }
  if ($storeId === '') {
    return null;
  }
  $bytes = file_get_contents($filePath);
  if ($bytes === false || $bytes === '') {
    return null;
  }
  $pathname = 'bank-transfer-slips/slip-' . bin2hex(random_bytes(12)) . '.' . $ext;
  $baseUrl = trim((string)(getenv('VERCEL_BLOB_API_URL') ?: ''));
  if ($baseUrl === '') {
    $baseUrl = 'https://vercel.com/api/blob';
  }
  $url = rtrim($baseUrl, '/') . '/?' . http_build_query(['pathname' => $pathname]);
  $apiVersion = (int)(getenv('VERCEL_BLOB_API_VERSION_OVERRIDE') ?: 12);

  $ch = curl_init($url);
  if ($ch === false) {
    return null;
  }
  curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST => 'PUT',
    CURLOPT_POSTFIELDS => $bytes,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_HTTPHEADER => [
      'Authorization: Bearer ' . $token,
      'x-api-version: ' . $apiVersion,
      'x-vercel-blob-store-id: ' . $storeId,
      'x-vercel-blob-access: public',
      'x-content-type: ' . $mime,
      'x-content-length: ' . strlen($bytes),
      'x-add-random-suffix: 1',
      'Content-Type: ' . $mime,
    ],
  ]);
  $response = curl_exec($ch);
  $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  if ($status < 200 || $status >= 300 || !is_string($response) || $response === '') {
    return null;
  }
  $decoded = json_decode($response, true);
  if (!is_array($decoded)) {
    return null;
  }
  $blobUrl = trim((string)($decoded['url'] ?? $decoded['downloadUrl'] ?? ''));
  return $blobUrl !== '' ? $blobUrl : null;
}

function serve_local_bank_transfer_slip_file(string $name): void {
  $safe = basename($name);
  if ($safe === '' || $safe !== $name) {
    json_response(404, ['error' => 'not_found']);
  }
  if (!preg_match('/^slip_[a-f0-9]{24}\.(pdf|jpg|jpeg|png|webp)$/i', $safe)) {
    json_response(404, ['error' => 'not_found']);
  }
  $dir = bank_transfer_slips_local_upload_dir();
  if ($dir === null) json_response(404, ['error' => 'not_found']);
  $path = $dir . DIRECTORY_SEPARATOR . $safe;
  if (!is_file($path)) json_response(404, ['error' => 'not_found']);
  $mime = detect_banner_mime($path, []);
  header('Content-Type: ' . ($mime !== '' ? $mime : 'application/octet-stream'));
  header('Cache-Control: private, max-age=3600');
  readfile($path);
  exit;
}

function map_order_payment_fields(array $row): array {
  $method = trim((string)($row['payment_method'] ?? ''));
  if ($method === '') {
    $total = (int)($row['total_amount_cents'] ?? 0);
    $method = $total <= 0 ? 'free' : 'payhere';
  }
  $slipUrl = trim((string)($row['bank_transfer_slip_url'] ?? ''));
  return [
    'paymentMethod' => $method,
    'bankTransferSlipUrl' => $slipUrl !== '' ? $slipUrl : null,
    'bankTransferSlipUploadedAt' => !empty($row['bank_transfer_slip_uploaded_at'])
      ? gmdate('c', strtotime((string)$row['bank_transfer_slip_uploaded_at']))
      : null,
    'bankTransferConfirmedAt' => !empty($row['bank_transfer_confirmed_at'])
      ? gmdate('c', strtotime((string)$row['bank_transfer_confirmed_at']))
      : null,
  ];
}

function set_order_payment_method(PDO $pdo, int $orderId, string $method): void {
  ensure_order_bank_transfer_columns($pdo);
  $stmt = $pdo->prepare('UPDATE orders SET payment_method = ? WHERE id = ?');
  $stmt->execute([$method, $orderId]);
}

function attach_bank_transfer_to_public_event(array &$event, PDO $pdo, int $organizerUserId, array $eventRow): void {
  $methods = event_payment_methods_from_customization(
    json_decode((string)($eventRow['customization_json'] ?? ''), true) ?: []
  );

  $event['paymentMethods'] = [
    'payhere' => !empty($methods['payhere']),
    'bankTransfer' => false,
  ];
  $event['allowPayhere'] = !empty($methods['payhere']);
  $event['allowBankTransfer'] = false;
  $event['bankTransfer'] = null;

  if (empty($methods['bankTransfer'])) {
    return;
  }

  if (function_exists('ensure_organizer_profile_paid_event_columns')) {
    ensure_organizer_profile_paid_event_columns($pdo);
  }
  if (!function_exists('load_organizer_profile_row')) {
    return;
  }
  $profile = load_organizer_profile_row($pdo, $organizerUserId);
  if (!$profile || !organizer_receiving_bank_complete($profile)) {
    return;
  }
  $event['paymentMethods']['bankTransfer'] = true;
  $event['allowBankTransfer'] = true;
  $event['bankTransfer'] = organizer_receiving_bank_api_shape($profile);
}
