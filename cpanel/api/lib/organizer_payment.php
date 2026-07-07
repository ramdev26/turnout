<?php

const ORGANIZER_GATEWAY_MODES = ['turnout', 'own_payhere'];
const ORGANIZER_BILLING_STATUSES = ['none', 'pending', 'active', 'failed'];

function payment_encryption_key(): string {
  $cfg = get_config();
  $secret = trim((string)($cfg['session']['token_secret'] ?? ''));
  if ($secret === '') {
    $secret = trim((string)($cfg['payhere']['merchant_secret'] ?? 'turnout-payment-fallback'));
  }
  return hash('sha256', $secret, true);
}

function encrypt_payment_secret(string $plain): string {
  $plain = trim($plain);
  if ($plain === '') return '';
  $key = payment_encryption_key();
  $iv = random_bytes(16);
  $cipher = openssl_encrypt($plain, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
  if ($cipher === false) return '';
  return base64_encode($iv . $cipher);
}

function decrypt_payment_secret(string $encoded): string {
  $encoded = trim($encoded);
  if ($encoded === '') return '';
  $raw = base64_decode($encoded, true);
  if ($raw === false || strlen($raw) < 17) return '';
  $key = payment_encryption_key();
  $iv = substr($raw, 0, 16);
  $cipher = substr($raw, 16);
  $plain = openssl_decrypt($cipher, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
  return is_string($plain) ? $plain : '';
}

function ensure_organizer_payment_tables(PDO $pdo): void {
  static $checked = false;
  if ($checked) return;
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);

  if ($driver === 'sqlite') {
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS organizer_payment_settings (
        user_id INTEGER PRIMARY KEY,
        gateway_mode TEXT NOT NULL DEFAULT "turnout",
        payhere_merchant_id TEXT NULL,
        payhere_merchant_secret_enc TEXT NULL,
        billing_customer_token TEXT NULL,
        billing_card_last4 TEXT NULL,
        billing_card_brand TEXT NULL,
        billing_setup_status TEXT NOT NULL DEFAULT "none",
        billing_setup_at TEXT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )'
    );
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS organizer_billing_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        setup_order_id TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT "pending",
        raw_notify_json TEXT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )'
    );
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_billing_sessions_user ON organizer_billing_sessions(user_id, created_at DESC)');
    $checked = true;
    return;
  }

  if ($driver === 'pgsql') {
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS organizer_payment_settings (
        user_id BIGINT PRIMARY KEY,
        gateway_mode VARCHAR(32) NOT NULL DEFAULT \'turnout\',
        payhere_merchant_id VARCHAR(64) NULL,
        payhere_merchant_secret_enc TEXT NULL,
        billing_customer_token TEXT NULL,
        billing_card_last4 VARCHAR(8) NULL,
        billing_card_brand VARCHAR(32) NULL,
        billing_setup_status VARCHAR(16) NOT NULL DEFAULT \'none\',
        billing_setup_at TIMESTAMP NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )'
    );
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS organizer_billing_sessions (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        setup_order_id VARCHAR(64) NOT NULL UNIQUE,
        status VARCHAR(16) NOT NULL DEFAULT \'pending\',
        raw_notify_json JSONB NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )'
    );
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_billing_sessions_user ON organizer_billing_sessions(user_id, created_at DESC)');
    $checked = true;
    return;
  }

  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS organizer_payment_settings (
      user_id BIGINT UNSIGNED NOT NULL,
      gateway_mode ENUM('turnout','own_payhere') NOT NULL DEFAULT 'turnout',
      payhere_merchant_id VARCHAR(64) NULL,
      payhere_merchant_secret_enc TEXT NULL,
      billing_customer_token TEXT NULL,
      billing_card_last4 VARCHAR(8) NULL,
      billing_card_brand VARCHAR(32) NULL,
      billing_setup_status ENUM('none','pending','active','failed') NOT NULL DEFAULT 'none',
      billing_setup_at DATETIME NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id),
      CONSTRAINT fk_org_payment_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS organizer_billing_sessions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      setup_order_id VARCHAR(64) NOT NULL,
      status ENUM('pending','completed','failed') NOT NULL DEFAULT 'pending',
      raw_notify_json JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_billing_setup_order (setup_order_id),
      KEY idx_billing_sessions_user (user_id, created_at),
      CONSTRAINT fk_billing_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
  $checked = true;
}

function normalize_organizer_gateway_mode(string $mode): string {
  $mode = strtolower(trim($mode));
  return in_array($mode, ORGANIZER_GATEWAY_MODES, true) ? $mode : 'turnout';
}

function load_organizer_payment_settings_row(PDO $pdo, int $userId): ?array {
  ensure_organizer_payment_tables($pdo);
  $stmt = $pdo->prepare('SELECT * FROM organizer_payment_settings WHERE user_id = ? LIMIT 1');
  $stmt->execute([$userId]);
  $row = $stmt->fetch();
  return is_array($row) ? $row : null;
}

function default_organizer_payment_settings_row(int $userId): array {
  return [
    'user_id' => $userId,
    'gateway_mode' => 'turnout',
    'payhere_merchant_id' => null,
    'payhere_merchant_secret_enc' => null,
    'billing_customer_token' => null,
    'billing_card_last4' => null,
    'billing_card_brand' => null,
    'billing_setup_status' => 'none',
    'billing_setup_at' => null,
  ];
}

function organizer_payment_settings_row(PDO $pdo, int $userId): array {
  $row = load_organizer_payment_settings_row($pdo, $userId);
  return is_array($row) ? $row : default_organizer_payment_settings_row($userId);
}

function organizer_billing_is_active(array $row): bool {
  return (string)($row['billing_setup_status'] ?? 'none') === 'active'
    && trim((string)($row['billing_customer_token'] ?? '')) !== '';
}

function organizer_own_payhere_is_configured(array $row): bool {
  return trim((string)($row['payhere_merchant_id'] ?? '')) !== ''
    && trim((string)($row['payhere_merchant_secret_enc'] ?? '')) !== '';
}

function organizer_payment_is_ready(array $row): bool {
  $mode = normalize_organizer_gateway_mode((string)($row['gateway_mode'] ?? 'turnout'));
  if ($mode === 'own_payhere') {
    return organizer_own_payhere_is_configured($row);
  }
  return organizer_billing_is_active($row);
}

function organizer_payment_settings_api_shape(PDO $pdo, int $userId): array {
  $row = organizer_payment_settings_row($pdo, $userId);
  $mode = normalize_organizer_gateway_mode((string)($row['gateway_mode'] ?? 'turnout'));
  $commissionPct = get_platform_commission_pct($pdo);
  $billingStatus = (string)($row['billing_setup_status'] ?? 'none');
  if (!in_array($billingStatus, ORGANIZER_BILLING_STATUSES, true)) {
    $billingStatus = 'none';
  }

  return [
    'gatewayMode' => $mode,
    'ownPayhereMerchantId' => trim((string)($row['payhere_merchant_id'] ?? '')),
    'ownPayhereSecretConfigured' => trim((string)($row['payhere_merchant_secret_enc'] ?? '')) !== '',
    'billing' => [
      'status' => $billingStatus,
      'cardLast4' => trim((string)($row['billing_card_last4'] ?? '')) ?: null,
      'cardBrand' => trim((string)($row['billing_card_brand'] ?? '')) ?: null,
      'setupAt' => $row['billing_setup_at'] ?? null,
    ],
    'commissionPct' => $commissionPct,
    'isReady' => organizer_payment_is_ready($row),
    'requirements' => [
      'needsBillingCard' => $mode === 'turnout' && !organizer_billing_is_active($row),
      'needsOwnPayhereCredentials' => $mode === 'own_payhere' && !organizer_own_payhere_is_configured($row),
    ],
  ];
}

function upsert_organizer_payment_settings(PDO $pdo, int $userId, array $fields): array {
  ensure_organizer_payment_tables($pdo);
  $existing = organizer_payment_settings_row($pdo, $userId);
  $gatewayMode = array_key_exists('gateway_mode', $fields)
    ? normalize_organizer_gateway_mode((string)$fields['gateway_mode'])
    : normalize_organizer_gateway_mode((string)($existing['gateway_mode'] ?? 'turnout'));
  $merchantId = array_key_exists('payhere_merchant_id', $fields)
    ? trim((string)$fields['payhere_merchant_id'])
    : trim((string)($existing['payhere_merchant_id'] ?? ''));
  $secretEnc = (string)($existing['payhere_merchant_secret_enc'] ?? '');
  if (array_key_exists('payhere_merchant_secret', $fields)) {
    $secretPlain = trim((string)$fields['payhere_merchant_secret']);
    if ($secretPlain !== '') {
      $secretEnc = encrypt_payment_secret($secretPlain);
    }
  }

  if ($gatewayMode === 'own_payhere') {
    if ($merchantId === '') {
      json_response(400, ['error' => 'invalid_payhere_merchant_id', 'message' => 'PayHere merchant ID is required.']);
    }
    if ($secretEnc === '') {
      json_response(400, ['error' => 'invalid_payhere_merchant_secret', 'message' => 'PayHere merchant secret is required.']);
    }
  }

  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  $merchantIdValue = $merchantId !== '' ? $merchantId : null;
  $secretEncValue = $secretEnc !== '' ? $secretEnc : null;

  if ($driver === 'sqlite') {
    $stmt = $pdo->prepare(
      'INSERT INTO organizer_payment_settings (user_id, gateway_mode, payhere_merchant_id, payhere_merchant_secret_enc, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET
         gateway_mode = excluded.gateway_mode,
         payhere_merchant_id = excluded.payhere_merchant_id,
         payhere_merchant_secret_enc = excluded.payhere_merchant_secret_enc,
         updated_at = CURRENT_TIMESTAMP'
    );
    $stmt->execute([$userId, $gatewayMode, $merchantIdValue, $secretEncValue]);
  } elseif ($driver === 'pgsql') {
    $stmt = $pdo->prepare(
      'INSERT INTO organizer_payment_settings (user_id, gateway_mode, payhere_merchant_id, payhere_merchant_secret_enc, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         gateway_mode = EXCLUDED.gateway_mode,
         payhere_merchant_id = EXCLUDED.payhere_merchant_id,
         payhere_merchant_secret_enc = EXCLUDED.payhere_merchant_secret_enc,
         updated_at = CURRENT_TIMESTAMP'
    );
    $stmt->execute([$userId, $gatewayMode, $merchantIdValue, $secretEncValue]);
  } else {
    $stmt = $pdo->prepare(
      'INSERT INTO organizer_payment_settings (user_id, gateway_mode, payhere_merchant_id, payhere_merchant_secret_enc)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         gateway_mode = VALUES(gateway_mode),
         payhere_merchant_id = VALUES(payhere_merchant_id),
         payhere_merchant_secret_enc = VALUES(payhere_merchant_secret_enc)'
    );
    $stmt->execute([$userId, $gatewayMode, $merchantIdValue, $secretEncValue]);
  }

  return organizer_payment_settings_row($pdo, $userId);
}

function set_organizer_billing_setup_status(PDO $pdo, int $userId, string $status): void {
  ensure_organizer_payment_tables($pdo);
  $status = in_array($status, ORGANIZER_BILLING_STATUSES, true) ? $status : 'none';
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);

  if ($driver === 'sqlite') {
    $pdo->prepare(
      'INSERT INTO organizer_payment_settings (user_id, gateway_mode, billing_setup_status, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET
         billing_setup_status = excluded.billing_setup_status,
         updated_at = CURRENT_TIMESTAMP'
    )->execute([$userId, 'turnout', $status]);
    return;
  }

  if ($driver === 'pgsql') {
    $pdo->prepare(
      'INSERT INTO organizer_payment_settings (user_id, gateway_mode, billing_setup_status, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         billing_setup_status = EXCLUDED.billing_setup_status,
         updated_at = CURRENT_TIMESTAMP'
    )->execute([$userId, 'turnout', $status]);
    return;
  }

  $pdo->prepare(
    'INSERT INTO organizer_payment_settings (user_id, gateway_mode, billing_setup_status)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE billing_setup_status = VALUES(billing_setup_status)'
  )->execute([$userId, 'turnout', $status]);
}

function payhere_cfg_for_organizer(PDO $pdo, int $organizerUserId): array {
  $row = organizer_payment_settings_row($pdo, $organizerUserId);
  $mode = normalize_organizer_gateway_mode((string)($row['gateway_mode'] ?? 'turnout'));

  if ($mode === 'own_payhere') {
    if (!organizer_own_payhere_is_configured($row)) {
      json_response(400, [
        'error' => 'organizer_payhere_not_configured',
        'message' => 'Connect your PayHere merchant ID and secret in Organization settings before selling tickets.',
      ]);
    }
    $platform = payhere_cfg();
    $merchantId = trim((string)$row['payhere_merchant_id']);
    $merchantSecret = decrypt_payment_secret((string)($row['payhere_merchant_secret_enc'] ?? ''));
    if ($merchantId === '' || $merchantSecret === '') {
      json_response(400, [
        'error' => 'organizer_payhere_not_configured',
        'message' => 'Organizer PayHere credentials are incomplete. Update payment settings.',
      ]);
    }
    return [
      'sandbox' => (bool)$platform['sandbox'],
      'merchant_id' => $merchantId,
      'merchant_secret' => $merchantSecret,
      'notify_url' => $platform['notify_url'],
      'app_base_url' => $platform['app_base_url'],
      'gateway_mode' => 'own_payhere',
      'organizer_user_id' => $organizerUserId,
    ];
  }

  if (!organizer_billing_is_active($row)) {
    json_response(400, [
      'error' => 'organizer_billing_required',
      'message' => 'Add a billing card in Organization settings before selling tickets with Turnout Pay.',
    ]);
  }

  $platform = payhere_cfg();
  return array_merge($platform, [
    'gateway_mode' => 'turnout',
    'organizer_user_id' => $organizerUserId,
  ]);
}

function resolve_payhere_cfg_by_merchant_id(PDO $pdo, string $merchantId): ?array {
  $merchantId = trim($merchantId);
  if ($merchantId === '') return null;

  $platform = payhere_cfg();
  if ($merchantId === (string)$platform['merchant_id']) {
    return array_merge($platform, ['gateway_mode' => 'turnout']);
  }

  ensure_organizer_payment_tables($pdo);
  $stmt = $pdo->prepare(
    'SELECT user_id, payhere_merchant_secret_enc FROM organizer_payment_settings
     WHERE gateway_mode = ? AND payhere_merchant_id = ? LIMIT 1'
  );
  $stmt->execute(['own_payhere', $merchantId]);
  $row = $stmt->fetch();
  if (!is_array($row)) return null;

  $secret = decrypt_payment_secret((string)($row['payhere_merchant_secret_enc'] ?? ''));
  if ($secret === '') return null;

  return [
    'sandbox' => (bool)$platform['sandbox'],
    'merchant_id' => $merchantId,
    'merchant_secret' => $secret,
    'notify_url' => $platform['notify_url'],
    'app_base_url' => $platform['app_base_url'],
    'gateway_mode' => 'own_payhere',
    'organizer_user_id' => (int)$row['user_id'],
  ];
}

function organizer_billing_setup_order_id(int $userId): string {
  return 'bill' . $userId . 't' . (string)time();
}

function payhere_preapprove_payment(
  array $cfg,
  string $merchantId,
  string $merchantSecret,
  string $orderIdStr,
  string $itemsTitle,
  string $firstName,
  string $lastName,
  string $email,
  string $phone,
  string $returnUrl,
  string $cancelUrl,
  string $notifyUrl
): array {
  $currency = 'LKR';
  $amountFormatted = '10.00';
  $hash = payhere_hash($merchantId, $orderIdStr, $amountFormatted, $currency, $merchantSecret);
  if ($hash === '') {
    json_response(500, ['error' => 'payhere_hash_failed', 'message' => 'Could not generate PayHere preapproval hash.']);
  }

  return [
    'sandbox' => (bool)$cfg['sandbox'],
    'merchant_id' => (string)$merchantId,
    'return_url' => $returnUrl,
    'cancel_url' => $cancelUrl,
    'notify_url' => $notifyUrl,
    'order_id' => $orderIdStr,
    'items' => $itemsTitle,
    'currency' => $currency,
    'amount' => $amountFormatted,
    'first_name' => $firstName,
    'last_name' => $lastName,
    'email' => $email,
    'phone' => $phone,
    'address' => 'N/A',
    'city' => 'N/A',
    'country' => 'Sri Lanka',
    'hash' => $hash,
    'preapprove' => true,
    'custom_1' => 'turnout_billing',
    'custom_2' => '',
  ];
}

function create_organizer_billing_session(PDO $pdo, int $userId, string $setupOrderId): void {
  ensure_organizer_payment_tables($pdo);
  $stmt = $pdo->prepare('INSERT INTO organizer_billing_sessions (user_id, setup_order_id, status) VALUES (?, ?, ?)');
  $stmt->execute([$userId, $setupOrderId, 'pending']);
}

function complete_organizer_billing_session(PDO $pdo, int $userId, string $setupOrderId, array $notifyPost): bool {
  ensure_organizer_payment_tables($pdo);
  $stmt = $pdo->prepare('SELECT id, user_id, status FROM organizer_billing_sessions WHERE setup_order_id = ? LIMIT 1');
  $stmt->execute([$setupOrderId]);
  $session = $stmt->fetch();
  if (!is_array($session) || (int)$session['user_id'] !== $userId) {
    return false;
  }

  $customerToken = trim((string)($notifyPost['customer_token'] ?? ''));
  $cardNo = trim((string)($notifyPost['card_no'] ?? ''));
  $cardHolder = trim((string)($notifyPost['card_holder_name'] ?? ''));
  $statusCode = (string)($notifyPost['status_code'] ?? '');
  $rawJson = json_encode($notifyPost, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

  $updSession = $pdo->prepare('UPDATE organizer_billing_sessions SET status = ?, raw_notify_json = ? WHERE id = ?');
  if ($statusCode !== '2' || $customerToken === '') {
    $updSession->execute(['failed', $rawJson, (int)$session['id']]);
    set_organizer_billing_setup_status($pdo, $userId, 'failed');
    return false;
  }

  $last4 = '';
  if (preg_match('/(\d{4})$/', str_replace(['*', ' '], '', $cardNo), $m)) {
    $last4 = $m[1];
  }
  $brand = '';
  if (str_contains(strtolower($cardHolder), 'visa')) {
    $brand = 'VISA';
  } elseif (str_contains(strtolower($cardHolder), 'master')) {
    $brand = 'MASTERCARD';
  }

  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  if ($driver === 'sqlite') {
    $upsert = $pdo->prepare(
      'INSERT INTO organizer_payment_settings (
        user_id, gateway_mode, billing_customer_token, billing_card_last4, billing_card_brand,
        billing_setup_status, billing_setup_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        gateway_mode = excluded.gateway_mode,
        billing_customer_token = excluded.billing_customer_token,
        billing_card_last4 = excluded.billing_card_last4,
        billing_card_brand = excluded.billing_card_brand,
        billing_setup_status = excluded.billing_setup_status,
        billing_setup_at = excluded.billing_setup_at,
        updated_at = CURRENT_TIMESTAMP'
    );
    $upsert->execute([
      $userId,
      'turnout',
      $customerToken,
      $last4 !== '' ? $last4 : null,
      $brand !== '' ? $brand : null,
      'active',
    ]);
  } elseif ($driver === 'pgsql') {
    $upsert = $pdo->prepare(
      'INSERT INTO organizer_payment_settings (
        user_id, gateway_mode, billing_customer_token, billing_card_last4, billing_card_brand,
        billing_setup_status, billing_setup_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO UPDATE SET
        gateway_mode = EXCLUDED.gateway_mode,
        billing_customer_token = EXCLUDED.billing_customer_token,
        billing_card_last4 = EXCLUDED.billing_card_last4,
        billing_card_brand = EXCLUDED.billing_card_brand,
        billing_setup_status = EXCLUDED.billing_setup_status,
        billing_setup_at = EXCLUDED.billing_setup_at,
        updated_at = CURRENT_TIMESTAMP'
    );
    $upsert->execute([
      $userId,
      'turnout',
      $customerToken,
      $last4 !== '' ? $last4 : null,
      $brand !== '' ? $brand : null,
      'active',
    ]);
  } else {
    $upsert = $pdo->prepare(
      'INSERT INTO organizer_payment_settings (
        user_id, gateway_mode, billing_customer_token, billing_card_last4, billing_card_brand,
        billing_setup_status, billing_setup_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE
        gateway_mode = VALUES(gateway_mode),
        billing_customer_token = VALUES(billing_customer_token),
        billing_card_last4 = VALUES(billing_card_last4),
        billing_card_brand = VALUES(billing_card_brand),
        billing_setup_status = VALUES(billing_setup_status),
        billing_setup_at = VALUES(billing_setup_at)'
    );
    $upsert->execute([
      $userId,
      'turnout',
      $customerToken,
      $last4 !== '' ? $last4 : null,
      $brand !== '' ? $brand : null,
      'active',
    ]);
  }

  $updSession->execute(['completed', $rawJson, (int)$session['id']]);
  return true;
}
