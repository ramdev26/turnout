<?php

function mail_config(): array {
  $cfg = get_config();
  return is_array($cfg['mail'] ?? null) ? $cfg['mail'] : [];
}

function mail_from_address(?PDO $pdo = null): string {
  $mail = mail_config();
  $from = trim((string)($mail['from'] ?? ''));
  if ($from === '' && $pdo instanceof PDO) {
    try {
      $stmt = $pdo->prepare('SELECT setting_value FROM global_settings WHERE setting_key = ? LIMIT 1');
      $stmt->execute(['email_from']);
      $row = $stmt->fetch();
      if ($row) {
        $from = trim((string)$row['setting_value']);
      }
    } catch (Throwable $e) {
      // ignore
    }
  }
  if ($from === '') {
    $from = 'admin@bigturnout.co';
  }
  return $from;
}

function mail_from_name(): string {
  $mail = mail_config();
  $name = trim((string)($mail['from_name'] ?? ''));
  return $name !== '' ? $name : 'Turnout';
}

function mail_format_from(?PDO $pdo = null): string {
  $email = mail_from_address($pdo);
  $name = mail_from_name();
  if ($name === '') {
    return $email;
  }
  return $name . ' <' . $email . '>';
}

function mail_extract_email(string $fromHeader): string {
  if (preg_match('/<([^>]+)>/', $fromHeader, $m)) {
    return trim($m[1]);
  }
  return trim($fromHeader);
}

/**
 * Send via Plunk (https://www.useplunk.com) — primary transport when API key is configured.
 */
function plunk_send_email(string $to, string $subject, string $htmlBody, string $fromEmail, array $mail): bool {
  $apiKey = trim((string)($mail['plunk_secret_key'] ?? ''));
  if ($apiKey === '') {
    return false;
  }

  $apiUrl = trim((string)($mail['plunk_api_url'] ?? 'https://next-api.useplunk.com/v1/send'));
  if ($apiUrl === '') {
    $apiUrl = 'https://next-api.useplunk.com/v1/send';
  }

  $from = mail_extract_email($fromEmail);
  if ($from === '' || !filter_var($from, FILTER_VALIDATE_EMAIL)) {
    $from = mail_from_address();
  }

  $payload = json_encode([
    'to' => $to,
    'subject' => $subject,
    'body' => $htmlBody,
    'from' => $from,
  ], JSON_UNESCAPED_UNICODE);

  if ($payload === false) {
    return false;
  }

  $ch = curl_init($apiUrl);
  if ($ch === false) {
    return false;
  }

  curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_HTTPHEADER => [
      'Authorization: Bearer ' . $apiKey,
      'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => $payload,
  ]);

  $response = curl_exec($ch);
  $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $curlError = curl_error($ch);
  curl_close($ch);

  if ($response === false) {
    error_log('Plunk send failed (curl): ' . $curlError);
    return false;
  }

  if ($httpCode < 200 || $httpCode >= 300) {
    error_log('Plunk send failed HTTP ' . $httpCode . ': ' . substr((string)$response, 0, 500));
    return false;
  }

  return true;
}

function send_email(string $to, string $subject, string $htmlBody, ?PDO $pdo = null): bool {
  $mail = mail_config();
  $enabled = (bool)($mail['enabled'] ?? false);
  if (!$enabled) {
    return true;
  }

  $to = trim($to);
  if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
    return false;
  }

  $from = mail_format_from($pdo);

  $plunkKey = trim((string)($mail['plunk_secret_key'] ?? ''));
  if ($plunkKey !== '') {
    return plunk_send_email($to, $subject, $htmlBody, $from, $mail);
  }

  $smtpHost = trim((string)($mail['smtp_host'] ?? ''));
  if ($smtpHost !== '') {
    return smtp_send_email($to, $subject, $htmlBody, $from, $mail);
  }

  $headers = [];
  $headers[] = 'MIME-Version: 1.0';
  $headers[] = 'Content-type: text/html; charset=utf-8';
  $headers[] = 'From: ' . $from;

  return @mail($to, $subject, $htmlBody, implode("\r\n", $headers));
}

function smtp_send_email(string $to, string $subject, string $htmlBody, string $fromHeader, array $mail): bool {
  $host = trim((string)($mail['smtp_host'] ?? ''));
  $port = (int)($mail['smtp_port'] ?? 587);
  $user = (string)($mail['smtp_user'] ?? '');
  $pass = (string)($mail['smtp_pass'] ?? '');
  $secure = strtolower(trim((string)($mail['smtp_secure'] ?? 'tls')));

  if ($host === '' || $port < 1) {
    return false;
  }

  $remote = $host . ':' . $port;
  if ($secure === 'ssl') {
    $remote = 'ssl://' . $remote;
  }

  $fp = @stream_socket_client($remote, $errno, $errstr, 20, STREAM_CLIENT_CONNECT);
  if (!$fp) {
    return false;
  }

  stream_set_timeout($fp, 20);

  $read = static function () use ($fp): string {
    $data = '';
    while (!feof($fp)) {
      $line = fgets($fp, 515);
      if ($line === false) {
        break;
      }
      $data .= $line;
      if (preg_match('/^\d{3} /', $line)) {
        break;
      }
    }
    return $data;
  };

  $write = static function (string $cmd) use ($fp): void {
    fwrite($fp, $cmd . "\r\n");
  };

  $expect = static function (string $resp, array $codes) use ($read): bool {
    $code = (int)substr(trim($resp), 0, 3);
    return in_array($code, $codes, true);
  };

  $greet = $read();
  if (!$expect($greet, [220])) {
    fclose($fp);
    return false;
  }

  $ehloHost = 'turnout.app';
  if ($secure === 'tls') {
    $write('EHLO ' . $ehloHost);
    $ehlo = $read();
    if (!$expect($ehlo, [250])) {
      fclose($fp);
      return false;
    }
    $write('STARTTLS');
    $tls = $read();
    if (!$expect($tls, [220])) {
      fclose($fp);
      return false;
    }
    if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
      fclose($fp);
      return false;
    }
  }

  $write('EHLO ' . $ehloHost);
  $ehlo2 = $read();
  if (!$expect($ehlo2, [250])) {
    fclose($fp);
    return false;
  }

  if ($user !== '') {
    $write('AUTH LOGIN');
    $auth = $read();
    if (!$expect($auth, [334])) {
      fclose($fp);
      return false;
    }
    $write(base64_encode($user));
    $userResp = $read();
    if (!$expect($userResp, [334])) {
      fclose($fp);
      return false;
    }
    $write(base64_encode($pass));
    $passResp = $read();
    if (!$expect($passResp, [235])) {
      fclose($fp);
      return false;
    }
  }

  $fromEmail = $fromHeader;
  if (preg_match('/<([^>]+)>/', $fromHeader, $m)) {
    $fromEmail = $m[1];
  }

  $write('MAIL FROM:<' . $fromEmail . '>');
  $mf = $read();
  if (!$expect($mf, [250])) {
    fclose($fp);
    return false;
  }

  $write('RCPT TO:<' . $to . '>');
  $rcpt = $read();
  if (!$expect($rcpt, [250, 251])) {
    fclose($fp);
    return false;
  }

  $write('DATA');
  $dataReady = $read();
  if (!$expect($dataReady, [354])) {
    fclose($fp);
    return false;
  }

  $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
  $message =
    'From: ' . $fromHeader . "\r\n" .
    'To: <' . $to . ">\r\n" .
    'Subject: ' . $encodedSubject . "\r\n" .
    "MIME-Version: 1.0\r\n" .
    "Content-Type: text/html; charset=UTF-8\r\n" .
    "Content-Transfer-Encoding: 8bit\r\n" .
    "\r\n" .
    $htmlBody . "\r\n";

  $message = preg_replace("/\r\n\./", "\r\n..", $message) ?? $message;
  fwrite($fp, $message . "\r\n.\r\n");
  $sent = $read();
  if (!$expect($sent, [250])) {
    fclose($fp);
    return false;
  }

  $write('QUIT');
  fclose($fp);
  return true;
}

function mail_password_reset_url(string $token): string {
  $base = mail_app_base_url();
  if ($base === '' || $token === '') {
    return '';
  }
  return $base . '/reset-password?token=' . rawurlencode($token);
}

function send_password_reset_email(PDO $pdo, string $toEmail, string $token): bool {
  $resetUrl = mail_password_reset_url($token);
  if ($resetUrl === '') {
    error_log('Turnout: password reset URL could not be built (check app_base_url)');
    return false;
  }

  $inner =
    '<p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#e9f4ee;">We received a request to reset your Turnout password.</p>' .
    '<p style="margin:0 0 18px;font-size:15px;line-height:1.5;color:#e9f4ee;">Click the button below to choose a new password. This link expires in <strong style="color:#ffffff;">1 hour</strong>.</p>' .
    mail_cta_button($resetUrl, 'Reset password') .
    '<p style="margin:20px 0 0;font-size:13px;color:#93b5b7;line-height:1.5;">If you did not request this, you can ignore this email. Your password will not change.</p>';

  $subject = 'Reset your Turnout password';
  return send_email($toEmail, $subject, mail_turnout_layout('Password reset', $inner), $pdo);
}

function send_organizer_team_invite_email(
  PDO $pdo,
  string $toEmail,
  string $inviterName,
  string $organizationName,
  string $role,
  string $token
): bool {
  $base = mail_app_base_url();
  if ($base === '') {
    error_log('Turnout: team invite URL could not be built (check app_base_url)');
    return false;
  }
  $acceptUrl = $base . '/invite/accept?token=' . rawurlencode($token);
  $orgLabel = $organizationName !== '' ? $organizationName : 'a Turnout workspace';
  $inner =
    '<p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#e9f4ee;">' .
    htmlspecialchars($inviterName, ENT_QUOTES, 'UTF-8') .
    ' invited you to join <strong style="color:#ffffff;">' .
    htmlspecialchars($orgLabel, ENT_QUOTES, 'UTF-8') .
    '</strong> on Turnout as <strong style="color:#ffffff;">' .
    htmlspecialchars($role, ENT_QUOTES, 'UTF-8') .
    '</strong>.</p>' .
    '<p style="margin:0 0 18px;font-size:15px;line-height:1.5;color:#e9f4ee;">Sign in with this email, then accept the invite to access events and tools for this organization.</p>' .
    mail_cta_button($acceptUrl, 'Accept invitation') .
    '<p style="margin:20px 0 0;font-size:13px;color:#93b5b7;line-height:1.5;">This invite expires in 7 days. If you were not expecting this, you can ignore this email.</p>';

  $subject = 'You are invited to join ' . $orgLabel . ' on Turnout';
  return send_email($toEmail, $subject, mail_turnout_layout('Team invitation', $inner), $pdo);
}

function mail_order_success_url(int $orderId, ?int $attendeeId = null, ?array $attendeeIds = null): string {
  $base = mail_app_base_url();
  if ($base === '') {
    return '';
  }
  $token = issue_order_access_token($orderId, $attendeeId, $attendeeIds);
  if ($token === '') {
    return '';
  }
  $url = $base . '/orders/' . rawurlencode((string)$orderId) . '/success?token=' . rawurlencode($token);

  $resolvedIds = [];
  if ($attendeeId !== null && $attendeeId > 0) {
    $resolvedIds = [$attendeeId];
  } elseif (is_array($attendeeIds) && count($attendeeIds) > 0) {
    $resolvedIds = array_values(array_unique(array_filter(array_map('intval', $attendeeIds), static fn($id) => $id > 0)));
  }
  if (count($resolvedIds) === 1) {
    $url .= '&pass=' . rawurlencode((string)$resolvedIds[0]);
  }

  return $url;
}

function mail_app_base_url(): string {
  $cfg = get_config();
  $fromCfg = trim((string)(($cfg['payhere'] ?? [])['app_base_url'] ?? ''));
  if ($fromCfg !== '') {
    return rtrim($fromCfg, '/');
  }
  $host = trim((string)($_SERVER['HTTP_HOST'] ?? ''));
  if ($host === '') {
    return '';
  }
  $proto = 'http';
  $https = strtolower(trim((string)($_SERVER['HTTPS'] ?? '')));
  if ($https !== '' && $https !== 'off') {
    $proto = 'https';
  } elseif (strtolower(trim((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''))) === 'https') {
    $proto = 'https';
  }
  return $proto . '://' . $host;
}

function mail_qr_image_url(string $qrToken): string {
  return 'https://quickchart.io/qr?text=' . rawurlencode($qrToken) . '&size=200&margin=2&dark=0a2426&light=f5f2ea';
}

function mail_turnout_layout(string $headline, string $innerHtml): string {
  return '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#052e30;font-family:Segoe UI,Arial,sans-serif;color:#e9f4ee;">' .
    '<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;"><tr><td align="center">' .
    '<table width="100%" style="max-width:560px;background:#0d585b;border-radius:16px;border:1px solid rgba(192,255,114,0.22);overflow:hidden;">' .
    '<tr><td style="padding:22px 28px;background:linear-gradient(135deg,#074143 0%,#0d585b 100%);color:#e9f4ee;">' .
    '<div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#c0ff72;">Turnout</div>' .
    '<h1 style="margin:10px 0 0;font-size:22px;font-weight:700;color:#ffffff;">' . $headline . '</h1>' .
    '</td></tr>' .
    '<tr><td style="padding:28px;color:#e9f4ee;">' . $innerHtml . '</td></tr>' .
    '</table></td></tr></table></body></html>';
}

function mail_event_details_block(string $eventTitle, string $eventDate, string $eventLocation, string $extraRowsHtml = ''): string {
  $html =
    '<table width="100%" style="background:rgba(255,255,255,0.06);border-radius:12px;border:1px solid rgba(192,255,114,0.15);margin-bottom:20px;">' .
    '<tr><td style="padding:16px 18px;">' .
    '<div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#93b5b7;margin-bottom:8px;">Event</div>' .
    '<div style="font-size:17px;font-weight:700;color:#ffffff;">' . $eventTitle . '</div>';
  if ($eventDate !== '') {
    $html .= '<div style="margin-top:10px;font-size:14px;color:#e9f4ee;"><strong style="color:#c0ff72;">When</strong><br/>' . $eventDate . '</div>';
  }
  if ($eventLocation !== '') {
    $html .= '<div style="margin-top:8px;font-size:14px;color:#e9f4ee;"><strong style="color:#c0ff72;">Where</strong><br/>' . $eventLocation . '</div>';
  }
  $html .= $extraRowsHtml . '</td></tr></table>';
  return $html;
}

function mail_cta_button(string $url, string $label): string {
  if ($url === '') {
    return '';
  }
  return '<p style="margin:22px 0 0;text-align:center;">' .
    '<a href="' . htmlspecialchars($url) . '" style="display:inline-block;background:#c0ff72;color:#0a2426;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:12px;">' .
    htmlspecialchars($label) . '</a></p>';
}

function mail_pass_block_html(array $pass): string {
  $name = htmlspecialchars((string)($pass['full_name'] ?? 'Guest'));
  $ticketName = htmlspecialchars((string)($pass['ticket_name'] ?? 'Ticket'));
  $qrToken = (string)($pass['qr_token'] ?? '');
  $qrImg = $qrToken !== '' ? mail_qr_image_url($qrToken) : '';

  $block =
    '<table width="100%" style="margin:0 0 16px;background:rgba(5,46,48,0.65);border-radius:12px;border:1px solid rgba(192,255,114,0.18);">' .
    '<tr><td style="padding:16px;">' .
    '<div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#c0ff72;">' . $ticketName . '</div>' .
    '<div style="margin-top:6px;font-size:16px;font-weight:700;color:#ffffff;">' . $name . '</div>';

  if ($qrImg !== '') {
    $block .=
      '<div style="margin-top:14px;text-align:center;">' .
      '<img src="' . htmlspecialchars($qrImg) . '" alt="Check-in QR code" width="200" height="200" style="display:inline-block;border-radius:12px;background:#f5f2ea;padding:8px;" />' .
      '</div>';
  }

  if ($qrToken !== '') {
    $block .=
      '<div style="margin-top:12px;padding:10px 12px;border-radius:8px;background:#052e30;font-family:Consolas,Monaco,monospace;font-size:11px;color:#e5ffc4;word-break:break-all;">' .
      htmlspecialchars($qrToken) .
      '</div>';
  }

  $block .= '</td></tr></table>';
  return $block;
}

function send_buyer_order_confirmation_email(
  PDO $pdo,
  array $order,
  int $orderId,
  array $attendees,
  string $ticketUrl
): bool {
  $buyerEmail = strtolower(trim((string)$order['buyer_email']));
  if ($buyerEmail === '' || !filter_var($buyerEmail, FILTER_VALIDATE_EMAIL)) {
    return false;
  }

  $items = json_decode((string)($order['tickets_json'] ?? '[]'), true);
  if (!is_array($items)) {
    $items = [];
  }

  $ticketLines = [];
  foreach ($items as $it) {
    if (!is_array($it)) {
      continue;
    }
    $name = trim((string)($it['name'] ?? $it['ticketName'] ?? 'Ticket'));
    $qty = (int)($it['quantity'] ?? 0);
    if ($qty > 0) {
      $ticketLines[] = htmlspecialchars($name) . ' × ' . $qty;
    }
  }

  $eventTitle = htmlspecialchars((string)$order['event_title']);
  $eventDate = htmlspecialchars((string)$order['event_date']);
  $eventLocation = htmlspecialchars((string)($order['location'] ?? ''));
  $buyerName = htmlspecialchars((string)($order['buyer_name'] ?? 'Guest'));
  $orderRef = htmlspecialchars((string)$orderId);
  $total = 'LKR ' . number_format(((int)$order['total_amount_cents']) / 100, 2);

  $extraRows =
    '<div style="margin-top:12px;font-size:14px;color:#e9f4ee;"><strong style="color:#c0ff72;">Order</strong><br/>#' . $orderRef . '</div>' .
    '<div style="margin-top:8px;font-size:14px;color:#e9f4ee;"><strong style="color:#c0ff72;">Total</strong><br/>' . $total . '</div>';
  if (count($ticketLines)) {
    $extraRows .= '<div style="margin-top:8px;font-size:14px;color:#e9f4ee;"><strong style="color:#c0ff72;">Tickets</strong><br/>' . implode('<br/>', $ticketLines) . '</div>';
  }

  $passBlocks = '';
  foreach ($attendees as $a) {
    $passBlocks .= mail_pass_block_html($a);
  }

  $buyerNorm = strtolower(trim((string)$order['buyer_email']));
  $otherEmails = [];
  foreach ($attendees as $a) {
    $em = strtolower(trim((string)($a['email'] ?? '')));
    if ($em !== '' && $em !== $buyerNorm && filter_var($em, FILTER_VALIDATE_EMAIL)) {
      $otherEmails[$em] = true;
    }
  }
  $otherHolderCount = count($otherEmails);

  $inner =
    '<p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Hi ' . $buyerName . ',</p>' .
    '<p style="margin:0 0 18px;font-size:15px;line-height:1.5;color:#e9f4ee;">Thanks for your purchase — your order is confirmed.</p>' .
    mail_event_details_block($eventTitle, $eventDate, $eventLocation, $extraRows) .
    ($passBlocks !== '' ? '<p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#c0ff72;text-transform:uppercase;letter-spacing:0.08em;">Your passes</p>' . $passBlocks : '') .
    ($otherHolderCount > 0
      ? '<p style="margin:0 0 12px;font-size:14px;color:#93b5b7;">We also emailed each ticket holder their own pass' .
        ($otherHolderCount > 1 ? 'es' : '') . ' at the address you provided.</p>'
      : '') .
    mail_cta_button($ticketUrl, 'View all tickets online') .
    '<p style="margin:20px 0 0;font-size:13px;color:#93b5b7;line-height:1.5;">Show the QR code at the entrance for check-in. Save this email or use the link above.</p>';

  $subject = 'Order confirmed — ' . (string)$order['event_title'];
  return send_email($buyerEmail, $subject, mail_turnout_layout('You\'re in!', $inner), $pdo);
}

function send_attendee_ticket_email(
  PDO $pdo,
  string $toEmail,
  string $recipientName,
  array $passes,
  array $order,
  int $orderId,
  string $ticketUrl
): bool {
  $eventTitle = htmlspecialchars((string)$order['event_title']);
  $eventDate = htmlspecialchars((string)$order['event_date']);
  $eventLocation = htmlspecialchars((string)($order['location'] ?? ''));
  $greeting = htmlspecialchars($recipientName !== '' ? $recipientName : 'there');
  $passCount = count($passes);

  $passBlocks = '';
  foreach ($passes as $pass) {
    $passBlocks .= mail_pass_block_html($pass);
  }

  $inner =
    '<p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Hi ' . $greeting . ',</p>' .
    '<p style="margin:0 0 18px;font-size:15px;line-height:1.5;color:#e9f4ee;">' .
    ($passCount > 1
      ? 'You have <strong style="color:#ffffff;">' . $passCount . ' tickets</strong> for'
      : 'You have a ticket for') .
    ' <strong style="color:#ffffff;">' . $eventTitle . '</strong>. ' .
    'Show the QR code below at the door.</p>' .
    mail_event_details_block($eventTitle, $eventDate, $eventLocation) .
    $passBlocks .
    mail_cta_button($ticketUrl, 'View your ticket' . ($passCount > 1 ? 's' : '')) .
    '<p style="margin:20px 0 0;font-size:13px;color:#93b5b7;line-height:1.5;">This pass was sent to you by the person who completed the purchase. If anything looks wrong, contact the event organizer.</p>';

  $subject = $passCount > 1
    ? 'Your ' . $passCount . ' tickets for ' . (string)$order['event_title']
    : 'Your ticket for ' . (string)$order['event_title'];

  return send_email($toEmail, $subject, mail_turnout_layout('Your ticket' . ($passCount > 1 ? 's' : ''), $inner), $pdo);
}

/**
 * Sends purchaser confirmation plus individual ticket emails to each unique holder email.
 */
function send_order_confirmation_email(PDO $pdo, int $orderId): bool {
  $stmt = $pdo->prepare(
    'SELECT o.id, o.buyer_name, o.buyer_email, o.buyer_phone, o.total_amount_cents, o.tickets_json,
            e.title AS event_title, e.event_date, e.location, e.slug
     FROM orders o
     INNER JOIN events e ON e.id = o.event_id
     WHERE o.id = ?
     LIMIT 1'
  );
  $stmt->execute([$orderId]);
  $order = $stmt->fetch();
  if (!$order) {
    return false;
  }

  $attStmt = $pdo->prepare(
    'SELECT a.id, a.full_name, a.email, a.qr_token, t.name AS ticket_name
     FROM attendees a
     LEFT JOIN tickets t ON t.id = a.ticket_id
     WHERE a.order_id = ?
     ORDER BY a.id ASC'
  );
  $attStmt->execute([$orderId]);
  $attendees = $attStmt->fetchAll() ?: [];

  $buyerTicketUrl = mail_order_success_url($orderId);

  $buyerOk = send_buyer_order_confirmation_email($pdo, $order, $orderId, $attendees, $buyerTicketUrl);

  $buyerEmail = strtolower(trim((string)$order['buyer_email']));
  $byEmail = [];
  foreach ($attendees as $a) {
    $email = strtolower(trim((string)($a['email'] ?? '')));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
      continue;
    }
    if (!isset($byEmail[$email])) {
      $byEmail[$email] = [];
    }
    $byEmail[$email][] = $a;
  }

  $attendeeOk = true;
  foreach ($byEmail as $email => $passes) {
    if ($email === $buyerEmail) {
      continue;
    }
    $recipientName = trim((string)($passes[0]['full_name'] ?? ''));
    $passIds = array_map(static fn($p) => (int)($p['id'] ?? 0), $passes);
    $holderTicketUrl = mail_order_success_url($orderId, null, $passIds);
    if (!send_attendee_ticket_email($pdo, $email, $recipientName, $passes, $order, $orderId, $holderTicketUrl)) {
      $attendeeOk = false;
      error_log('Turnout: failed attendee ticket email for order ' . $orderId . ' to ' . $email);
    }
  }

  return $buyerOk && $attendeeOk;
}
