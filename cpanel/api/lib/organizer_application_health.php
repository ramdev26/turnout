<?php

/**
 * Application health checklist for an organizer workspace.
 * Scores setup completeness from signup → profile → docs → payments → first event.
 *
 * @return array{
 *   score:int,
 *   grade:string,
 *   label:string,
 *   completed:int,
 *   total:int,
 *   pendingCount:int,
 *   items:list<array<string,mixed>>,
 *   categories:list<array{id:string,label:string,completed:int,total:int}>
 * }
 */
function organizer_application_health(PDO $pdo, int $ownerUserId): array {
  ensure_organizer_profile_paid_event_columns($pdo);
  ensure_email_verification_support($pdo);

  $userStmt = $pdo->prepare('SELECT id, email, display_name, email_verified_at, role FROM users WHERE id = ? LIMIT 1');
  $userStmt->execute([$ownerUserId]);
  $userRow = $userStmt->fetch() ?: [];

  $profileRow = load_organizer_profile_row($pdo, $ownerUserId) ?: [];
  $paymentRow = function_exists('organizer_payment_settings_row')
    ? organizer_payment_settings_row($pdo, $ownerUserId)
    : [];
  $gatewayMode = function_exists('normalize_organizer_gateway_mode')
    ? normalize_organizer_gateway_mode((string)($paymentRow['gateway_mode'] ?? 'turnout'))
    : 'turnout';

  $emailVerified = function_exists('user_email_is_verified')
    ? user_email_is_verified($userRow)
    : !empty($userRow['email_verified_at']);
  $displayName = trim((string)($userRow['display_name'] ?? ''));
  $orgName = trim((string)($profileRow['organization_name'] ?? ''));
  $logo = trim((string)($profileRow['logo_url'] ?? ''));
  $phone = trim((string)($profileRow['phone'] ?? ''));
  $website = trim((string)($profileRow['website'] ?? ''));
  $businessAddress = trim((string)($profileRow['business_address'] ?? ''));
  $brDoc = trim((string)($profileRow['business_registration_doc_url'] ?? ''));
  $bankStatement = trim((string)($profileRow['bank_statement_doc_url'] ?? ''));
  $termsHtml = trim((string)($profileRow['terms_html'] ?? ''));
  $bankReady = function_exists('organizer_bank_details_complete')
    ? organizer_bank_details_complete($profileRow)
    : false;

  $gatewayReady = true;
  $gatewayDetail = 'Turnout Pay is active — you can sell tickets now.';
  if ($gatewayMode === 'own_payhere') {
    $credsOk = function_exists('organizer_own_payhere_is_configured')
      && organizer_own_payhere_is_configured($paymentRow);
    $billingOk = function_exists('organizer_billing_is_active')
      && organizer_billing_is_active($paymentRow);
    $gatewayReady = $credsOk && $billingOk;
    $gatewayDetail = $gatewayReady
      ? 'Your own gateway is connected.'
      : 'Connect merchant credentials and an account card to finish own-gateway setup.';
  }

  $eventCount = 0;
  $publishedCount = 0;
  try {
    $evStmt = $pdo->prepare(
      "SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published
       FROM events
       WHERE organizer_user_id = ?"
    );
    $evStmt->execute([$ownerUserId]);
    $evRow = $evStmt->fetch() ?: [];
    $eventCount = (int)($evRow['total'] ?? 0);
    $publishedCount = (int)($evRow['published'] ?? 0);
  } catch (Throwable $e) {
    // Non-fatal for health scoring.
  }

  $items = [
    [
      'id' => 'email_verified',
      'category' => 'account',
      'categoryLabel' => 'Account',
      'label' => 'Verify your email',
      'detail' => $emailVerified
        ? 'Email is verified.'
        : 'Confirm the link we sent so your account stays secure.',
      'done' => $emailVerified,
      'required' => true,
      'weight' => 12,
      'href' => $emailVerified
        ? '/dashboard/organization#org-profile'
        : ('/verify-email?email=' . rawurlencode(strtolower(trim((string)($userRow['email'] ?? ''))))),
    ],
    [
      'id' => 'display_name',
      'category' => 'account',
      'categoryLabel' => 'Account',
      'label' => 'Add your display name',
      'detail' => $displayName !== '' ? 'Display name is set.' : 'Shown on your organizer account.',
      'done' => $displayName !== '',
      'required' => true,
      'weight' => 8,
      'href' => '/dashboard/organization#org-profile',
    ],
    [
      'id' => 'organization_name',
      'category' => 'profile',
      'categoryLabel' => 'Organization profile',
      'label' => 'Set organization name',
      'detail' => $orgName !== ''
        ? 'Organization name is set.'
        : 'Appears on public event pages and tickets.',
      'done' => $orgName !== '',
      'required' => true,
      'weight' => 12,
      'href' => '/dashboard/organization#org-profile',
    ],
    [
      'id' => 'logo',
      'category' => 'profile',
      'categoryLabel' => 'Organization profile',
      'label' => 'Upload organization logo',
      'detail' => $logo !== '' ? 'Logo uploaded.' : 'Helps attendees recognize your brand.',
      'done' => $logo !== '',
      'required' => false,
      'weight' => 8,
      'href' => '/dashboard/organization#org-profile',
    ],
    [
      'id' => 'phone',
      'category' => 'profile',
      'categoryLabel' => 'Organization profile',
      'label' => 'Add a contact phone',
      'detail' => $phone !== '' ? 'Phone number saved.' : 'Useful for support and payouts contact.',
      'done' => $phone !== '',
      'required' => false,
      'weight' => 6,
      'href' => '/dashboard/organization#org-profile',
    ],
    [
      'id' => 'website',
      'category' => 'profile',
      'categoryLabel' => 'Organization profile',
      'label' => 'Add your website',
      'detail' => $website !== '' ? 'Website saved.' : 'Optional link for your organization.',
      'done' => $website !== '',
      'required' => false,
      'weight' => 3,
      'href' => '/dashboard/organization#org-profile',
    ],
    [
      'id' => 'business_address',
      'category' => 'business',
      'categoryLabel' => 'Business details',
      'label' => 'Add business address',
      'detail' => $businessAddress !== ''
        ? 'Business address saved.'
        : 'Recommended for paid events and records.',
      'done' => $businessAddress !== '',
      'required' => false,
      'weight' => 6,
      'href' => '/dashboard/organization#org-profile',
    ],
    [
      'id' => 'business_registration_doc',
      'category' => 'business',
      'categoryLabel' => 'Business details',
      'label' => 'Upload Business Registration (BR)',
      'detail' => $brDoc !== ''
        ? 'BR document uploaded.'
        : 'Upload your BR document when you have it.',
      'done' => $brDoc !== '',
      'required' => false,
      'weight' => 7,
      'href' => '/dashboard/organization#org-profile',
    ],
    [
      'id' => 'bank_statement_doc',
      'category' => 'business',
      'categoryLabel' => 'Business details',
      'label' => 'Upload bank statement',
      'detail' => $bankStatement !== ''
        ? 'Bank statement uploaded.'
        : 'Optional supporting document for payouts.',
      'done' => $bankStatement !== '',
      'required' => false,
      'weight' => 4,
      'href' => '/dashboard/organization#org-profile',
    ],
    [
      'id' => 'terms',
      'category' => 'terms',
      'categoryLabel' => 'Terms',
      'label' => 'Review organization terms',
      'detail' => $termsHtml !== ''
        ? 'Custom terms saved.'
        : 'Default template is active — customize when ready.',
      'done' => $termsHtml !== '',
      'required' => false,
      'weight' => 5,
      'href' => '/dashboard/organization#org-terms',
    ],
    [
      'id' => 'payment_gateway',
      'category' => 'payments',
      'categoryLabel' => 'Payments',
      'label' => $gatewayMode === 'own_payhere' ? 'Finish your payment gateway' : 'Checkout ready (Turnout Pay)',
      'detail' => $gatewayDetail,
      'done' => $gatewayReady,
      'required' => true,
      'weight' => 12,
      'href' => '/dashboard/organization#org-payments',
    ],
    [
      'id' => 'bank_payout',
      'category' => 'payments',
      'categoryLabel' => 'Payments',
      'label' => 'Add bank account for payouts',
      'detail' => $bankReady
        ? 'Payout bank account is linked.'
        : 'Only needed when you want to withdraw earnings (or offer bank transfer).',
      'done' => $bankReady,
      'required' => false,
      'weight' => 10,
      'href' => '/dashboard/organization#org-payments',
    ],
    [
      'id' => 'first_event',
      'category' => 'events',
      'categoryLabel' => 'Events',
      'label' => 'Create your first event',
      'detail' => $eventCount > 0
        ? ($publishedCount > 0
          ? sprintf('%d published event%s.', $publishedCount, $publishedCount === 1 ? '' : 's')
          : sprintf('%d draft event%s — publish when ready.', $eventCount, $eventCount === 1 ? '' : 's'))
        : 'Launch a free or paid event to go live.',
      'done' => $eventCount > 0,
      'required' => false,
      'weight' => 10,
      'href' => '/events/themes',
    ],
    [
      'id' => 'published_event',
      'category' => 'events',
      'categoryLabel' => 'Events',
      'label' => 'Publish an event',
      'detail' => $publishedCount > 0
        ? 'You have a live published event.'
        : 'Publish when tickets are ready for the public.',
      'done' => $publishedCount > 0,
      'required' => false,
      'weight' => 8,
      'href' => '/dashboard',
    ],
  ];

  $earned = 0;
  $max = 0;
  $completed = 0;
  foreach ($items as $item) {
    $w = (int)$item['weight'];
    $max += $w;
    if (!empty($item['done'])) {
      $earned += $w;
      $completed++;
    }
  }

  $score = $max > 0 ? (int)round(($earned / $max) * 100) : 0;
  if ($score >= 90) {
    $grade = 'A';
    $label = 'Excellent';
  } elseif ($score >= 75) {
    $grade = 'B';
    $label = 'Good';
  } elseif ($score >= 55) {
    $grade = 'C';
    $label = 'Fair';
  } else {
    $grade = 'D';
    $label = 'Needs work';
  }

  $pending = [];
  foreach ($items as $item) {
    if (empty($item['done'])) $pending[] = $item;
  }

  $categoryMap = [];
  foreach ($items as $item) {
    $cid = (string)$item['category'];
    if (!isset($categoryMap[$cid])) {
      $categoryMap[$cid] = [
        'id' => $cid,
        'label' => (string)$item['categoryLabel'],
        'completed' => 0,
        'total' => 0,
      ];
    }
    $categoryMap[$cid]['total']++;
    if (!empty($item['done'])) $categoryMap[$cid]['completed']++;
  }

  return [
    'score' => $score,
    'grade' => $grade,
    'label' => $label,
    'completed' => $completed,
    'total' => count($items),
    'pendingCount' => count($pending),
    'items' => $items,
    'pending' => $pending,
    'categories' => array_values($categoryMap),
    'gatewayMode' => $gatewayMode,
  ];
}
