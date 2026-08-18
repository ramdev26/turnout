<?php

/**
 * Internal ops emails: event published, Turnout Pay KYC submitted.
 */

function admin_notify_extra_emails(?PDO $pdo = null): array {
  $raw = trim((string)(getenv('ADMIN_NOTIFY_EMAIL') ?: ''));
  if ($raw === '' && $pdo instanceof PDO) {
    try {
      $stmt = $pdo->prepare('SELECT setting_value FROM global_settings WHERE setting_key = ? LIMIT 1');
      $stmt->execute(['admin_notify_email']);
      $row = $stmt->fetch();
      if ($row) {
        $raw = trim((string)$row['setting_value']);
      }
    } catch (Throwable $e) {
      // ignore
    }
  }

  $out = [];
  if ($raw !== '') {
    foreach (preg_split('/[,;\s]+/', $raw) ?: [] as $part) {
      $email = strtolower(trim((string)$part));
      if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $out[$email] = true;
      }
    }
  }
  return array_keys($out);
}

function admin_notify_recipient_emails(PDO $pdo): array {
  $emails = [];
  foreach (admin_notify_extra_emails($pdo) as $email) {
    $emails[$email] = true;
  }

  try {
    $stmt = $pdo->query("SELECT email FROM users WHERE role = 'super_admin' AND COALESCE(status, 'active') = 'active'");
    if ($stmt) {
      while ($row = $stmt->fetch()) {
        $email = strtolower(trim((string)($row['email'] ?? '')));
        if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
          $emails[$email] = true;
        }
      }
    }
  } catch (Throwable $e) {
    // ignore
  }

  if ($emails === []) {
    $fallback = strtolower(trim(mail_from_address($pdo)));
    if ($fallback !== '' && filter_var($fallback, FILTER_VALIDATE_EMAIL)) {
      $emails[$fallback] = true;
    }
  }

  return array_keys($emails);
}

function admin_notify_send(PDO $pdo, string $subject, string $innerHtml): void {
  $recipients = admin_notify_recipient_emails($pdo);
  if ($recipients === []) return;
  $html = mail_turnout_layout($subject, $innerHtml);
  foreach ($recipients as $to) {
    try {
      send_email($to, $subject, $html, $pdo);
    } catch (Throwable $e) {
      error_log('[turnout] admin notify failed for ' . $to . ': ' . $e->getMessage());
    }
  }
}

function admin_console_organizers_url(): string {
  $base = rtrim(canonical_public_app_origin(app_base_url()), '/');
  return $base . '/basadmin/organizers';
}

function admin_console_events_url(): string {
  $base = rtrim(canonical_public_app_origin(app_base_url()), '/');
  return $base . '/basadmin/events';
}

function notify_admins_event_published(PDO $pdo, int $eventId): void {
  if ($eventId <= 0) return;
  try {
    $stmt = $pdo->prepare(
      'SELECT e.id, e.title, e.slug, e.status, e.event_date, e.location, e.organizer_user_id,
              u.email AS organizer_email, u.display_name AS organizer_name
       FROM events e
       JOIN users u ON u.id = e.organizer_user_id
       WHERE e.id = ?
       LIMIT 1'
    );
    $stmt->execute([$eventId]);
    $event = $stmt->fetch();
    if (!$event || (string)($event['status'] ?? '') !== 'published') return;

    $ticketStmt = $pdo->prepare('SELECT name, price_cents, quantity FROM tickets WHERE event_id = ? ORDER BY id ASC');
    $ticketStmt->execute([$eventId]);
    $tickets = $ticketStmt->fetchAll() ?: [];
    $paid = false;
    $ticketLines = '';
    foreach ($tickets as $t) {
      if (!is_array($t)) continue;
      $cents = (int)($t['price_cents'] ?? 0);
      if ($cents > 0) $paid = true;
      $price = $cents > 0 ? mail_format_lkr_from_cents($cents) : 'Free';
      $ticketLines .= '<li>' . htmlspecialchars((string)$t['name']) . ' · ' . htmlspecialchars($price) .
        ' · qty ' . (int)($t['quantity'] ?? 0) . '</li>';
    }

    $slug = (string)$event['slug'];
    $publicUrl = rtrim(canonical_public_app_origin(app_base_url()), '/') . '/e/' . rawurlencode($slug);
    $kind = $paid ? 'Paid' : 'Free';
    $when = '';
    try {
      $when = date('D, j M Y g:ia', strtotime((string)$event['event_date']));
    } catch (Throwable $e) {
      $when = (string)$event['event_date'];
    }

    $inner =
      '<p style="margin:0 0 16px;font-size:15px;line-height:1.55;">An organizer just published an event.</p>' .
      mail_event_details_block(
        htmlspecialchars((string)$event['title']),
        htmlspecialchars($when),
        htmlspecialchars((string)$event['location']),
        '<div style="margin-top:8px;font-size:14px;color:#374151;"><strong style="color:#111827;">Type</strong><br/>' .
          htmlspecialchars($kind) . ' event</div>'
      ) .
      '<p style="margin:0 0 8px;font-size:14px;"><strong>Organizer:</strong> ' .
      htmlspecialchars((string)$event['organizer_name']) . ' &lt;' .
      htmlspecialchars((string)$event['organizer_email']) . '&gt;</p>' .
      ($ticketLines !== '' ? '<p style="margin:12px 0 6px;font-size:14px;"><strong>Tickets</strong></p><ul style="margin:0 0 16px;padding-left:18px;">' . $ticketLines . '</ul>' : '') .
      mail_cta_button($publicUrl, 'View public page') .
      mail_cta_button(admin_console_events_url(), 'Open admin events');

    admin_notify_send($pdo, 'Event published: ' . (string)$event['title'], $inner);
  } catch (Throwable $e) {
    error_log('[turnout] notify event published failed: ' . $e->getMessage());
  }
}

function notify_admins_gateway_documents(PDO $pdo, int $ownerUserId, string $kind): void {
  if ($ownerUserId <= 0) return;
  try {
    ensure_organizer_gateway_review_columns($pdo);
    $user = load_user_profile($ownerUserId);
    $row = load_organizer_profile_row($pdo, $ownerUserId);
    $kindLabel = $kind === 'br' ? 'Business registration' : 'Bank statement';
    $status = organizer_gateway_review_status($row);
    $br = trim((string)($row['business_registration_doc_url'] ?? '')) !== '';
    $stmtDoc = trim((string)($row['bank_statement_doc_url'] ?? '')) !== '';
    $org = trim((string)($row['organization_name'] ?? '')) ?: ((string)($user['displayName'] ?? 'Organizer'));

    $inner =
      '<p style="margin:0 0 16px;font-size:15px;line-height:1.55;">' .
      htmlspecialchars($org) . ' submitted a document to use Turnout Pay.</p>' .
      '<table width="100%" style="font-size:14px;border-collapse:collapse;">' .
      mail_detail_row('Organizer', htmlspecialchars((string)($user['displayName'] ?? ''))) .
      mail_detail_row('Email', htmlspecialchars((string)($user['email'] ?? ''))) .
      mail_detail_row('Just uploaded', htmlspecialchars($kindLabel)) .
      mail_detail_row('Business registration', $br ? 'Uploaded' : 'Missing') .
      mail_detail_row('Bank statement', $stmtDoc ? 'Uploaded' : 'Missing') .
      mail_detail_row('Review status', htmlspecialchars($status)) .
      '</table>' .
      mail_cta_button(admin_console_organizers_url(), 'Review in admin');

    admin_notify_send($pdo, 'Turnout Pay documents: ' . $org, $inner);
  } catch (Throwable $e) {
    error_log('[turnout] notify gateway docs failed: ' . $e->getMessage());
  }
}

function notify_organizer_gateway_review(PDO $pdo, int $ownerUserId, string $status, string $note = ''): void {
  $user = load_user_profile($ownerUserId);
  $email = strtolower(trim((string)($user['email'] ?? '')));
  if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) return;

  $approved = $status === 'approved';
  $headline = $approved ? 'Turnout Pay is approved' : 'Turnout Pay application needs changes';
  $body = $approved
    ? '<p style="margin:0 0 16px;font-size:15px;line-height:1.55;">Your documents were approved. You can now publish paid events using Turnout Pay.</p>'
    : '<p style="margin:0 0 16px;font-size:15px;line-height:1.55;">Your Turnout Pay application was not approved yet. Please update your documents in Organization settings and resubmit.</p>';
  if ($note !== '') {
    $body .= '<p style="margin:0 0 16px;font-size:14px;"><strong>Note from Turnout:</strong> ' . htmlspecialchars($note) . '</p>';
  }
  $url = rtrim(canonical_public_app_origin(app_base_url()), '/') . '/dashboard/organization';
  $body .= mail_cta_button($url, 'Open Organization settings');
  try {
    send_email($email, $headline, mail_turnout_layout($headline, $body), $pdo);
  } catch (Throwable $e) {
    error_log('[turnout] organizer gateway review email failed: ' . $e->getMessage());
  }
}
