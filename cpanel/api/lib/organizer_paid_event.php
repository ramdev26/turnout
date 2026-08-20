<?php

function ensure_organizer_profile_paid_event_columns(PDO $pdo): void {
  static $checked = false;
  if ($checked) return;
  ensure_organizer_workspace_tables($pdo);
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);

  $columns = [
    'business_address' => $driver === 'pgsql' ? 'TEXT NULL' : 'TEXT NULL',
    'business_registration_no' => $driver === 'pgsql' ? 'VARCHAR(128) NULL' : 'VARCHAR(128) NULL',
    'bank_account_holder_name' => $driver === 'pgsql' ? 'VARCHAR(255) NULL' : 'VARCHAR(255) NULL',
    'bank_name' => $driver === 'pgsql' ? 'VARCHAR(255) NULL' : 'VARCHAR(255) NULL',
    'bank_branch' => $driver === 'pgsql' ? 'VARCHAR(255) NULL' : 'VARCHAR(255) NULL',
    'bank_account_number' => $driver === 'pgsql' ? 'VARCHAR(64) NULL' : 'VARCHAR(64) NULL',
    'bank_account_type' => $driver === 'pgsql' ? 'VARCHAR(64) NULL' : 'VARCHAR(64) NULL',
    'bank_address' => $driver === 'pgsql' ? 'TEXT NULL' : 'TEXT NULL',
    'bank_code' => $driver === 'pgsql' ? 'VARCHAR(32) NULL' : 'VARCHAR(32) NULL',
    'bank_branch_code' => $driver === 'pgsql' ? 'VARCHAR(32) NULL' : 'VARCHAR(32) NULL',
    'bank_swift_code' => $driver === 'pgsql' ? 'VARCHAR(32) NULL' : 'VARCHAR(32) NULL',
    'business_registration_doc_url' => $driver === 'pgsql' ? 'TEXT NULL' : 'TEXT NULL',
    'bank_statement_doc_url' => $driver === 'pgsql' ? 'TEXT NULL' : 'TEXT NULL',
    'terms_html' => $driver === 'pgsql' ? 'TEXT NULL' : 'TEXT NULL',
    'turnout_pay_docs_override' => $driver === 'pgsql' ? 'SMALLINT NOT NULL DEFAULT 0' : 'TINYINT NOT NULL DEFAULT 0',
  ];

  if ($driver === 'sqlite') {
    foreach ($columns as $name => $type) {
      try {
        $pdo->exec("ALTER TABLE organizer_profiles ADD COLUMN {$name} TEXT NULL");
      } catch (Throwable $e) {
        // Column already exists.
      }
    }
    $checked = true;
    return;
  }

  if ($driver === 'pgsql') {
    foreach ($columns as $name => $type) {
      try {
        $pdo->exec("ALTER TABLE organizer_profiles ADD COLUMN IF NOT EXISTS {$name} {$type}");
      } catch (Throwable $e) {
        // Ignore migration errors.
      }
    }
    $checked = true;
    return;
  }

  foreach ($columns as $name => $type) {
    try {
      $pdo->exec("ALTER TABLE organizer_profiles ADD COLUMN {$name} {$type}");
    } catch (Throwable $e) {
      // Column already exists.
    }
  }
  $checked = true;
}

function organizer_business_details_complete(array $profileRow): bool {
  return trim((string)($profileRow['organization_name'] ?? '')) !== ''
    && trim((string)($profileRow['business_address'] ?? '')) !== ''
    && trim((string)($profileRow['phone'] ?? '')) !== ''
    && trim((string)($profileRow['business_registration_doc_url'] ?? '')) !== ''
    && trim((string)($profileRow['bank_statement_doc_url'] ?? '')) !== '';
}

function organizer_bank_details_complete(array $profileRow): bool {
  // Bank statement upload remains optional KYC — do not block paid events on it.
  return trim((string)($profileRow['bank_account_holder_name'] ?? '')) !== ''
    && trim((string)($profileRow['bank_name'] ?? '')) !== ''
    && trim((string)($profileRow['bank_branch'] ?? '')) !== ''
    && trim((string)($profileRow['bank_account_number'] ?? '')) !== '';
}

function mask_bank_account_number(string $accountNumber): ?string {
  $accountNumber = trim($accountNumber);
  if ($accountNumber === '') return null;
  if (strlen($accountNumber) <= 4) return str_repeat('*', strlen($accountNumber));
  return str_repeat('*', max(0, strlen($accountNumber) - 4)) . substr($accountNumber, -4);
}

function organizer_profile_business_api_fields(array $profileRow): array {
  return [
    'businessAddress' => trim((string)($profileRow['business_address'] ?? '')) ?: null,
    'businessRegistrationNo' => trim((string)($profileRow['business_registration_no'] ?? '')) ?: null,
    'businessRegistrationDocUrl' => trim((string)($profileRow['business_registration_doc_url'] ?? '')) ?: null,
    'businessRegistrationDocUploaded' => trim((string)($profileRow['business_registration_doc_url'] ?? '')) !== '',
  ];
}

function organizer_profile_bank_api_fields(array $profileRow): array {
  $accountNumber = trim((string)($profileRow['bank_account_number'] ?? ''));
  return [
    'bankAccountHolderName' => trim((string)($profileRow['bank_account_holder_name'] ?? '')) ?: null,
    'bankName' => trim((string)($profileRow['bank_name'] ?? '')) ?: null,
    'bankBranch' => trim((string)($profileRow['bank_branch'] ?? '')) ?: null,
    'bankAccountNumberLast4' => $accountNumber !== '' ? substr($accountNumber, -4) : null,
    'bankAccountConfigured' => $accountNumber !== '',
    'bankAccountType' => trim((string)($profileRow['bank_account_type'] ?? '')) ?: null,
    'bankAddress' => trim((string)($profileRow['bank_address'] ?? '')) ?: null,
    'bankCode' => trim((string)($profileRow['bank_code'] ?? '')) ?: null,
    'bankBranchCode' => trim((string)($profileRow['bank_branch_code'] ?? '')) ?: null,
    'bankSwiftCode' => trim((string)($profileRow['bank_swift_code'] ?? '')) ?: null,
    'bankStatementDocUrl' => trim((string)($profileRow['bank_statement_doc_url'] ?? '')) ?: null,
    'bankStatementDocUploaded' => trim((string)($profileRow['bank_statement_doc_url'] ?? '')) !== '',
  ];
}

function organizer_turnout_pay_docs_override_enabled(array $profileRow): bool {
  return !empty($profileRow['turnout_pay_docs_override']) && (int)$profileRow['turnout_pay_docs_override'] === 1;
}

function set_organizer_turnout_pay_docs_override(PDO $pdo, int $ownerUserId, bool $enabled): void {
  ensure_organizer_profile_paid_event_columns($pdo);
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  $value = $enabled ? 1 : 0;
  if ($driver === 'sqlite') {
    $stmt = $pdo->prepare(
      "INSERT INTO organizer_profiles (user_id, turnout_pay_docs_override, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET turnout_pay_docs_override = excluded.turnout_pay_docs_override, updated_at = datetime('now')"
    );
    $stmt->execute([$ownerUserId, $value]);
    return;
  }
  if ($driver === 'pgsql') {
    $stmt = $pdo->prepare(
      'INSERT INTO organizer_profiles (user_id, turnout_pay_docs_override, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET turnout_pay_docs_override = EXCLUDED.turnout_pay_docs_override, updated_at = CURRENT_TIMESTAMP'
    );
    $stmt->execute([$ownerUserId, $value]);
    return;
  }
  $stmt = $pdo->prepare(
    'INSERT INTO organizer_profiles (user_id, turnout_pay_docs_override, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE turnout_pay_docs_override = VALUES(turnout_pay_docs_override), updated_at = CURRENT_TIMESTAMP'
  );
  $stmt->execute([$ownerUserId, $value]);
}

/** @param list<array<string, mixed>> $tickets */
function tickets_include_paid_price(array $tickets): bool {
  return tickets_include_paid_or_early_bird_price($tickets);
}

function organizer_paid_event_readiness(PDO $pdo, int $ownerUserId): array {
  ensure_organizer_profile_paid_event_columns($pdo);
  $profileRow = load_organizer_profile_row($pdo, $ownerUserId);
  $paymentRow = organizer_payment_settings_row($pdo, $ownerUserId);
  $gatewayMode = normalize_organizer_gateway_mode((string)($paymentRow['gateway_mode'] ?? 'turnout'));
  $turnoutDocsOverride = organizer_turnout_pay_docs_override_enabled($profileRow);

  $businessIncomplete = !organizer_business_details_complete($profileRow);
  // Temporarily do not block paid events on business details.
  $needsBusiness = false;
  $needsBank = $gatewayMode === 'turnout' && !$turnoutDocsOverride && !organizer_bank_details_complete($profileRow);
  $needsOwnPayhere = $gatewayMode === 'own_payhere' && !organizer_own_payhere_is_configured($paymentRow);
  $needsBillingCard = $gatewayMode === 'own_payhere' && !organizer_billing_is_active($paymentRow);

  $missing = [];
  if ($businessIncomplete) {
    if (trim((string)($profileRow['organization_name'] ?? '')) === '') $missing[] = 'organization_name';
    if (trim((string)($profileRow['business_address'] ?? '')) === '') $missing[] = 'business_address';
    if (trim((string)($profileRow['phone'] ?? '')) === '') $missing[] = 'phone';
    if (trim((string)($profileRow['business_registration_doc_url'] ?? '')) === '') $missing[] = 'business_registration_doc';
    if (trim((string)($profileRow['bank_statement_doc_url'] ?? '')) === '') $missing[] = 'bank_statement_doc';
  }
  if ($needsBank) {
    if (trim((string)($profileRow['bank_account_holder_name'] ?? '')) === '') $missing[] = 'bank_account_holder_name';
    if (trim((string)($profileRow['bank_name'] ?? '')) === '') $missing[] = 'bank_name';
    if (trim((string)($profileRow['bank_branch'] ?? '')) === '') $missing[] = 'bank_branch';
    if (trim((string)($profileRow['bank_account_number'] ?? '')) === '') $missing[] = 'bank_account_number';
  }

  // Business details stay optional. Own-gateway organizers must complete credentials + account card.
  $isReady = !$needsBank && !$needsOwnPayhere && !$needsBillingCard;

  return [
    'isReady' => $isReady,
    'gatewayMode' => $gatewayMode,
    'requirements' => [
      'needsBusinessDetails' => $needsBusiness,
      'needsBankDetails' => $needsBank,
      'needsOwnPayhereCredentials' => $needsOwnPayhere,
      'needsBillingCard' => $needsBillingCard,
      'turnoutDocsOverride' => $turnoutDocsOverride,
    ],
    'missing' => $missing,
    'business' => organizer_profile_business_api_fields($profileRow),
    'bank' => organizer_profile_bank_api_fields($profileRow),
  ];
}

function organizer_paid_event_readiness_api_shape(PDO $pdo, int $ownerUserId): array {
  $readiness = organizer_paid_event_readiness($pdo, $ownerUserId);
  $readiness['setupUrl'] = '/dashboard/organization';
  return $readiness;
}

function assert_organizer_can_sell_paid_tickets(PDO $pdo, int $ownerUserId, float $price): void {
  if ($price <= 0) return;
  $readiness = organizer_paid_event_readiness($pdo, $ownerUserId);
  if ($readiness['isReady']) return;

  $hint = ($readiness['gatewayMode'] ?? '') === 'own_payhere'
    ? 'Connect your own gateway and add an account card in Organization → Payments before selling paid tickets.'
    : 'Add your bank payout details in Organization → Payments before selling paid tickets.';

  json_response(400, [
    'error' => 'paid_event_setup_required',
    'message' => $hint,
    'readiness' => $readiness,
  ]);
}

/** @param list<array<string, mixed>> $tickets */
function assert_organizer_can_sell_paid_ticket_list(PDO $pdo, int $ownerUserId, array $tickets): void {
  if (!tickets_include_paid_price($tickets)) return;
  assert_organizer_can_sell_paid_tickets($pdo, $ownerUserId, 1);
}

function upsert_organizer_profile_paid_event_fields(PDO $pdo, int $userId, array $fields): array {
  ensure_organizer_profile_paid_event_columns($pdo);
  $existing = load_organizer_profile_row($pdo, $userId);
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);

  $organizationName = array_key_exists('organization_name', $fields)
    ? trim((string)$fields['organization_name'])
    : trim((string)($existing['organization_name'] ?? ''));
  $logoUrl = array_key_exists('logo_url', $fields)
    ? trim((string)$fields['logo_url'])
    : trim((string)($existing['logo_url'] ?? ''));
  $website = array_key_exists('website', $fields)
    ? trim((string)$fields['website'])
    : trim((string)($existing['website'] ?? ''));
  $phone = array_key_exists('phone', $fields)
    ? trim((string)$fields['phone'])
    : trim((string)($existing['phone'] ?? ''));
  $businessAddress = array_key_exists('business_address', $fields)
    ? trim((string)$fields['business_address'])
    : trim((string)($existing['business_address'] ?? ''));
  $businessRegistrationNo = array_key_exists('business_registration_no', $fields)
    ? trim((string)$fields['business_registration_no'])
    : trim((string)($existing['business_registration_no'] ?? ''));
  $bankAccountHolderName = array_key_exists('bank_account_holder_name', $fields)
    ? trim((string)$fields['bank_account_holder_name'])
    : trim((string)($existing['bank_account_holder_name'] ?? ''));
  $bankName = array_key_exists('bank_name', $fields)
    ? trim((string)$fields['bank_name'])
    : trim((string)($existing['bank_name'] ?? ''));
  $bankBranch = array_key_exists('bank_branch', $fields)
    ? trim((string)$fields['bank_branch'])
    : trim((string)($existing['bank_branch'] ?? ''));
  $bankAccountNumber = array_key_exists('bank_account_number', $fields)
    ? trim((string)$fields['bank_account_number'])
    : trim((string)($existing['bank_account_number'] ?? ''));
  $bankAccountType = array_key_exists('bank_account_type', $fields)
    ? trim((string)$fields['bank_account_type'])
    : trim((string)($existing['bank_account_type'] ?? ''));
  $bankAddress = array_key_exists('bank_address', $fields)
    ? trim((string)$fields['bank_address'])
    : trim((string)($existing['bank_address'] ?? ''));
  $bankCode = array_key_exists('bank_code', $fields)
    ? trim((string)$fields['bank_code'])
    : trim((string)($existing['bank_code'] ?? ''));
  $bankBranchCode = array_key_exists('bank_branch_code', $fields)
    ? trim((string)$fields['bank_branch_code'])
    : trim((string)($existing['bank_branch_code'] ?? ''));
  $bankSwiftCode = array_key_exists('bank_swift_code', $fields)
    ? trim((string)$fields['bank_swift_code'])
    : trim((string)($existing['bank_swift_code'] ?? ''));
  $businessRegistrationDocUrl = array_key_exists('business_registration_doc_url', $fields)
    ? trim((string)$fields['business_registration_doc_url'])
    : trim((string)($existing['business_registration_doc_url'] ?? ''));
  $bankStatementDocUrl = array_key_exists('bank_statement_doc_url', $fields)
    ? trim((string)$fields['bank_statement_doc_url'])
    : trim((string)($existing['bank_statement_doc_url'] ?? ''));

  $params = [
    $userId,
    mb_substr($organizationName, 0, 255),
    $logoUrl !== '' ? $logoUrl : null,
    $website !== '' ? $website : null,
    $phone !== '' ? $phone : null,
    $businessAddress !== '' ? $businessAddress : null,
    $businessRegistrationNo !== '' ? $businessRegistrationNo : null,
    $bankAccountHolderName !== '' ? $bankAccountHolderName : null,
    $bankName !== '' ? $bankName : null,
    $bankBranch !== '' ? $bankBranch : null,
    $bankAccountNumber !== '' ? $bankAccountNumber : null,
    $bankAccountType !== '' ? mb_substr($bankAccountType, 0, 64) : null,
    $bankAddress !== '' ? $bankAddress : null,
    $bankCode !== '' ? mb_substr($bankCode, 0, 32) : null,
    $bankBranchCode !== '' ? mb_substr($bankBranchCode, 0, 32) : null,
    $bankSwiftCode !== '' ? mb_substr($bankSwiftCode, 0, 32) : null,
    $businessRegistrationDocUrl !== '' ? $businessRegistrationDocUrl : null,
    $bankStatementDocUrl !== '' ? $bankStatementDocUrl : null,
  ];

  if ($driver === 'sqlite') {
    $stmt = $pdo->prepare(
      'INSERT INTO organizer_profiles (
        user_id, organization_name, logo_url, website, phone,
        business_address, business_registration_no,
        bank_account_holder_name, bank_name, bank_branch, bank_account_number,
        bank_account_type, bank_address, bank_code, bank_branch_code, bank_swift_code,
        business_registration_doc_url, bank_statement_doc_url,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        organization_name = excluded.organization_name,
        logo_url = excluded.logo_url,
        website = excluded.website,
        phone = excluded.phone,
        business_address = excluded.business_address,
        business_registration_no = excluded.business_registration_no,
        bank_account_holder_name = excluded.bank_account_holder_name,
        bank_name = excluded.bank_name,
        bank_branch = excluded.bank_branch,
        bank_account_number = excluded.bank_account_number,
        bank_account_type = excluded.bank_account_type,
        bank_address = excluded.bank_address,
        bank_code = excluded.bank_code,
        bank_branch_code = excluded.bank_branch_code,
        bank_swift_code = excluded.bank_swift_code,
        business_registration_doc_url = excluded.business_registration_doc_url,
        bank_statement_doc_url = excluded.bank_statement_doc_url,
        updated_at = CURRENT_TIMESTAMP'
    );
    $stmt->execute($params);
  } elseif ($driver === 'pgsql') {
    $stmt = $pdo->prepare(
      'INSERT INTO organizer_profiles (
        user_id, organization_name, logo_url, website, phone,
        business_address, business_registration_no,
        bank_account_holder_name, bank_name, bank_branch, bank_account_number,
        bank_account_type, bank_address, bank_code, bank_branch_code, bank_swift_code,
        business_registration_doc_url, bank_statement_doc_url,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO UPDATE SET
        organization_name = EXCLUDED.organization_name,
        logo_url = EXCLUDED.logo_url,
        website = EXCLUDED.website,
        phone = EXCLUDED.phone,
        business_address = EXCLUDED.business_address,
        business_registration_no = EXCLUDED.business_registration_no,
        bank_account_holder_name = EXCLUDED.bank_account_holder_name,
        bank_name = EXCLUDED.bank_name,
        bank_branch = EXCLUDED.bank_branch,
        bank_account_number = EXCLUDED.bank_account_number,
        bank_account_type = EXCLUDED.bank_account_type,
        bank_address = EXCLUDED.bank_address,
        bank_code = EXCLUDED.bank_code,
        bank_branch_code = EXCLUDED.bank_branch_code,
        bank_swift_code = EXCLUDED.bank_swift_code,
        business_registration_doc_url = EXCLUDED.business_registration_doc_url,
        bank_statement_doc_url = EXCLUDED.bank_statement_doc_url,
        updated_at = CURRENT_TIMESTAMP'
    );
    $stmt->execute($params);
  } else {
    $stmt = $pdo->prepare(
      'INSERT INTO organizer_profiles (
        user_id, organization_name, logo_url, website, phone,
        business_address, business_registration_no,
        bank_account_holder_name, bank_name, bank_branch, bank_account_number,
        bank_account_type, bank_address, bank_code, bank_branch_code, bank_swift_code,
        business_registration_doc_url, bank_statement_doc_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        organization_name = VALUES(organization_name),
        logo_url = VALUES(logo_url),
        website = VALUES(website),
        phone = VALUES(phone),
        business_address = VALUES(business_address),
        business_registration_no = VALUES(business_registration_no),
        bank_account_holder_name = VALUES(bank_account_holder_name),
        bank_name = VALUES(bank_name),
        bank_branch = VALUES(bank_branch),
        bank_account_number = VALUES(bank_account_number),
        bank_account_type = VALUES(bank_account_type),
        bank_address = VALUES(bank_address),
        bank_code = VALUES(bank_code),
        bank_branch_code = VALUES(bank_branch_code),
        bank_swift_code = VALUES(bank_swift_code),
        business_registration_doc_url = VALUES(business_registration_doc_url),
        bank_statement_doc_url = VALUES(bank_statement_doc_url)'
    );
    $stmt->execute($params);
  }

  return load_organizer_profile_row($pdo, $userId);
}

function sanitize_policy_html(string $raw): string {
  $clean = strip_tags($raw, '<p><br><br/><strong><b><em><i><u><ul><ol><li><h3><h4><a><span>');
  $clean = preg_replace('/\son\w+="[^"]*"/i', '', $clean) ?? $clean;
  $clean = preg_replace("/\son\w+='[^']*'/i", '', $clean) ?? $clean;
  $clean = preg_replace('/javascript:/i', '', $clean) ?? $clean;
  return trim($clean);
}

function upsert_organizer_terms_html(PDO $pdo, int $userId, string $termsHtml): void {
  ensure_organizer_profile_paid_event_columns($pdo);
  $clean = sanitize_policy_html($termsHtml);
  if ($clean === '') {
    $clean = null;
  } else {
    $clean = mb_substr($clean, 0, 20000);
  }
  // Ensure a profile row exists first.
  upsert_organizer_profile_paid_event_fields($pdo, $userId, []);
  $stmt = $pdo->prepare('UPDATE organizer_profiles SET terms_html = ? WHERE user_id = ?');
  $stmt->execute([$clean, $userId]);
}
