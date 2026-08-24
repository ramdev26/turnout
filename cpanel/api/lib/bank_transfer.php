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
    'accountType' => trim((string)($profileRow['bank_account_type'] ?? '')) ?: null,
    'bankAddress' => trim((string)($profileRow['bank_address'] ?? '')) ?: null,
    'bankCode' => trim((string)($profileRow['bank_code'] ?? '')) ?: null,
    'branchCode' => trim((string)($profileRow['bank_branch_code'] ?? '')) ?: null,
    'swiftCode' => trim((string)($profileRow['bank_swift_code'] ?? '')) ?: null,
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

/** Payment methods that never go through Turnout card checkout — no platform fee. */
function payment_method_waives_platform_fee(?string $method): bool {
  $method = strtolower(trim((string)$method));
  return in_array($method, [
    'bank_transfer',
    'free',
    'complimentary',
    'manual_cash',
    'manual_bank',
    'manual_other',
  ], true);
}

/** Ledger / notify references that are not a PayHere card capture. */
function payhere_reference_waives_platform_fee(?string $reference): bool {
  $ref = strtolower(trim((string)$reference));
  if ($ref === '') return false;
  return str_starts_with($ref, 'bank_transfer:')
    || str_starts_with($ref, 'manual_')
    || str_starts_with($ref, 'comp:')
    || str_starts_with($ref, 'complimentary');
}

function sale_waives_platform_fee(?string $paymentMethod, ?string $payhereReference): bool {
  return payment_method_waives_platform_fee($paymentMethod)
    || payhere_reference_waives_platform_fee($payhereReference);
}

/**
 * Turnout commission applies only to real PayHere card checkout.
 * Bank transfer, cash, complimentary, and unlabeled ledger rows are not card sales.
 */
function sale_is_payhere_card(?string $paymentMethod, ?string $payhereReference): bool {
  if (sale_waives_platform_fee($paymentMethod, $payhereReference)) return false;
  $method = strtolower(trim((string)$paymentMethod));
  $ref = trim((string)$payhereReference);
  if ($method === 'payhere' && $ref !== '') return true;
  // Legacy PayHere notify stored the gateway payment id before payment_method existed.
  if ($method === '' && $ref !== '') return true;
  return false;
}

/** True when this order/event should never be charged a Turnout platform fee. */
function order_waives_platform_fee(PDO $pdo, int $eventId, int $orderId, ?string $reference = null): bool {
  ensure_order_bank_transfer_columns($pdo);
  $stmt = $pdo->prepare('SELECT payment_method FROM orders WHERE id = ? LIMIT 1');
  $stmt->execute([$orderId]);
  $row = $stmt->fetch();
  $method = is_array($row) ? ($row['payment_method'] ?? null) : null;
  if ($reference === null || trim((string)$reference) === '') {
    $refStmt = $pdo->prepare('SELECT payhere_reference FROM transactions WHERE order_id = ? LIMIT 1');
    $refStmt->execute([$orderId]);
    $tx = $refStmt->fetch();
    if (is_array($tx) && ($reference === null || trim((string)$reference) === '')) {
      $reference = $tx['payhere_reference'] ?? null;
    }
  }
  if (sale_waives_platform_fee($method, $reference)) {
    return true;
  }

  $evStmt = $pdo->prepare('SELECT customization_json FROM events WHERE id = ? LIMIT 1');
  $evStmt->execute([$eventId]);
  $ev = $evStmt->fetch();
  if (!is_array($ev)) return false;
  $methods = event_payment_methods_from_customization(
    json_decode((string)($ev['customization_json'] ?? ''), true) ?: []
  );
  // Organizer / event is bank-transfer only (PayHere off).
  return empty($methods['payhere']) && !empty($methods['bankTransfer']);
}

function organizer_has_payhere_card_sales(PDO $pdo, int $organizerId): bool {
  ensure_order_bank_transfer_columns($pdo);
  $stmt = $pdo->prepare(
    "SELECT o.payment_method, t.payhere_reference
     FROM transactions t
     INNER JOIN events e ON e.id = t.event_id
     LEFT JOIN orders o ON o.id = t.order_id
     WHERE e.organizer_user_id = ?
       AND t.payment_status = 'paid'"
  );
  $stmt->execute([$organizerId]);
  while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    if (sale_is_payhere_card($row['payment_method'] ?? null, $row['payhere_reference'] ?? null)) {
      return true;
    }
  }
  return false;
}

function zero_transaction_platform_fee(PDO $pdo, int $transactionId, int $amountCents): void {
  $fix = $pdo->prepare(
    'UPDATE transactions SET platform_fee_cents = 0, organizer_amount_cents = ? WHERE id = ?'
  );
  $fix->execute([$amountCents, $transactionId]);
}

function reconcile_waived_platform_fees(PDO $pdo, ?int $organizerUserId = null): void {
  try {
    ensure_finance_tables($pdo);
    ensure_order_bank_transfer_columns($pdo);
    $sql =
      "SELECT t.id, t.amount_cents, t.platform_fee_cents, t.payhere_reference,
              e.organizer_user_id, o.payment_method
       FROM transactions t
       INNER JOIN events e ON e.id = t.event_id
       LEFT JOIN orders o ON o.id = t.order_id
       WHERE t.platform_fee_cents > 0";
    $params = [];
    if ($organizerUserId !== null && $organizerUserId > 0) {
      $sql .= ' AND e.organizer_user_id = ?';
      $params[] = $organizerUserId;
    }
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $hasCardByOrg = [];
    foreach ($rows as $row) {
      $oid = (int)($row['organizer_user_id'] ?? 0);
      $method = $row['payment_method'] ?? null;
      $ref = $row['payhere_reference'] ?? null;
      if (sale_is_payhere_card($method, $ref)) {
        continue;
      }
      $waive = sale_waives_platform_fee($method, $ref);
      if (!$waive && $oid > 0) {
        if (!array_key_exists($oid, $hasCardByOrg)) {
          $hasCardByOrg[$oid] = organizer_has_payhere_card_sales($pdo, $oid);
        }
        // Organizer has never taken a PayHere card payment — do not keep a commission.
        $waive = !$hasCardByOrg[$oid];
      }
      if (!$waive) continue;
      zero_transaction_platform_fee($pdo, (int)$row['id'], (int)$row['amount_cents']);
    }
  } catch (Throwable $e) {
    error_log(sprintf('[turnout] reconcile waived platform fees failed: %s', $e->getMessage()));
  }
}

function organizer_earnings_totals(PDO $pdo, int $organizerId): array {
  ensure_finance_tables($pdo);
  ensure_order_bank_transfer_columns($pdo);
  reconcile_waived_platform_fees($pdo, $organizerId);

  $stmt = $pdo->prepare(
    "SELECT
      COALESCE(SUM(CASE
        WHEN t.payment_status='paid'
          AND (
            t.order_id IS NULL
            OR EXISTS (SELECT 1 FROM attendees a WHERE a.order_id = t.order_id)
          )
        THEN t.amount_cents
        ELSE 0
      END),0) AS gross_cents,
      COALESCE(SUM(CASE
        WHEN t.payment_status='paid'
          AND (
            t.order_id IS NULL
            OR EXISTS (SELECT 1 FROM attendees a WHERE a.order_id = t.order_id)
          )
        THEN t.platform_fee_cents
        ELSE 0
      END),0) AS fee_cents,
      COALESCE(SUM(CASE
        WHEN t.payment_status='paid'
          AND (
            t.order_id IS NULL
            OR EXISTS (SELECT 1 FROM attendees a WHERE a.order_id = t.order_id)
          )
        THEN t.organizer_amount_cents
        ELSE 0
      END),0) AS net_cents
     FROM events e
     LEFT JOIN transactions t ON t.event_id = e.id
     WHERE e.organizer_user_id = ?"
  );
  $stmt->execute([$organizerId]);
  $sum = $stmt->fetch() ?: ['gross_cents' => 0, 'fee_cents' => 0, 'net_cents' => 0];
  return [
    'grossCents' => (int)($sum['gross_cents'] ?? 0),
    'feeCents' => (int)($sum['fee_cents'] ?? 0),
    'netCents' => (int)($sum['net_cents'] ?? 0),
  ];
}

function fetch_event_sales_stats_map(PDO $pdo, array $eventIds): array {
  $out = [];
  foreach ($eventIds as $id) {
    $eid = (int)$id;
    if ($eid <= 0) continue;
    $out[$eid] = [
      'soldTickets' => 0,
      'totalRevenue' => 0.0,
      'attendeeTotal' => 0,
      'checkedInCount' => 0,
    ];
  }
  if (!$out) return $out;

  $ids = array_keys($out);
  $placeholders = implode(',', array_fill(0, count($ids), '?'));

  $att = $pdo->prepare(
    "SELECT event_id,
            COUNT(*) AS total,
            SUM(CASE WHEN checked_in_at IS NOT NULL THEN 1 ELSE 0 END) AS checked_in
     FROM attendees
     WHERE event_id IN ($placeholders)
     GROUP BY event_id"
  );
  $att->execute($ids);
  while ($row = $att->fetch()) {
    $eid = (int)$row['event_id'];
    $total = (int)($row['total'] ?? 0);
    $out[$eid]['attendeeTotal'] = $total;
    $out[$eid]['checkedInCount'] = (int)($row['checked_in'] ?? 0);
    $out[$eid]['soldTickets'] = $total;
  }

  $rev = $pdo->prepare(
    "SELECT o.event_id, COALESCE(SUM(o.total_amount_cents), 0) AS revenue_cents
     FROM orders o
     WHERE o.event_id IN ($placeholders)
       AND o.status = 'paid'
       AND EXISTS (SELECT 1 FROM attendees a WHERE a.order_id = o.id)
     GROUP BY o.event_id"
  );
  $rev->execute($ids);
  while ($row = $rev->fetch()) {
    $eid = (int)$row['event_id'];
    $out[$eid]['totalRevenue'] = ((int)($row['revenue_cents'] ?? 0)) / 100;
  }

  return $out;
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
