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

  $buyerEmail = strtolower(trim((string)$order['buyer_email']));
  if ($buyerEmail === '' || !filter_var($buyerEmail, FILTER_VALIDATE_EMAIL)) {
    return false;
  }

  $attStmt = $pdo->prepare(
    'SELECT a.full_name, a.email, a.qr_token, t.name AS ticket_name
     FROM attendees a
     LEFT JOIN tickets t ON t.id = a.ticket_id
     WHERE a.order_id = ?
     ORDER BY a.id ASC'
  );
  $attStmt->execute([$orderId]);
  $attendees = $attStmt->fetchAll() ?: [];

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

  $attendeeBlocks = '';
  foreach ($attendees as $a) {
    $attendeeBlocks .=
      '<tr><td style="padding:8px 0;border-top:1px solid #e5e7eb;">' .
      '<strong>' . htmlspecialchars((string)$a['full_name']) . '</strong><br/>' .
      '<span style="color:#6b7280;font-size:13px;">' . htmlspecialchars((string)($a['ticket_name'] ?? 'Ticket')) . '</span>' .
      '</td></tr>';
  }

  $eventTitle = htmlspecialchars((string)$order['event_title']);
  $eventDate = htmlspecialchars((string)$order['event_date']);
  $eventLocation = htmlspecialchars((string)($order['location'] ?? ''));
  $buyerName = htmlspecialchars((string)($order['buyer_name'] ?? 'Guest'));
  $orderRef = htmlspecialchars((string)$orderId);
  $total = 'LKR ' . number_format(((int)$order['total_amount_cents']) / 100, 2);

  $accessToken = issue_order_access_token($orderId);
  $base = mail_app_base_url();
  $ticketUrl = $base !== '' ? $base . '/orders/' . rawurlencode((string)$orderId) . '/success?token=' . rawurlencode($accessToken) : '';

  $cta = $ticketUrl !== ''
    ? '<p style="margin:24px 0;"><a href="' . htmlspecialchars($ticketUrl) . '" style="display:inline-block;background:#00a95d;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px;">View your tickets</a></p>'
    : '';

  $subject = 'Your tickets for ' . (string)$order['event_title'];

  $bodyHtml =
    '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6f8;font-family:Segoe UI,Arial,sans-serif;color:#111827;">' .
    '<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;"><tr><td align="center">' .
    '<table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">' .
    '<tr><td style="padding:24px 28px;background:#0f172a;color:#fff;">' .
    '<div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.8;">Turnout</div>' .
    '<h1 style="margin:8px 0 0;font-size:22px;">You\'re in!</h1>' .
    '</td></tr>' .
    '<tr><td style="padding:28px;">' .
    '<p style="margin:0 0 16px;">Hi ' . $buyerName . ',</p>' .
    '<p style="margin:0 0 20px;">Thanks for your purchase. Your tickets are confirmed for <strong>' . $eventTitle . '</strong>.</p>' .
    '<table width="100%" style="background:#f9fafb;border-radius:12px;padding:16px;margin-bottom:20px;">' .
    '<tr><td style="padding:4px 0;"><strong>Event</strong><br/>' . $eventTitle . '</td></tr>' .
    ($eventDate !== '' ? '<tr><td style="padding:4px 0;"><strong>Date</strong><br/>' . $eventDate . '</td></tr>' : '') .
    ($eventLocation !== '' ? '<tr><td style="padding:4px 0;"><strong>Location</strong><br/>' . $eventLocation . '</td></tr>' : '') .
    '<tr><td style="padding:4px 0;"><strong>Order</strong><br/>#' . $orderRef . '</td></tr>' .
    '<tr><td style="padding:4px 0;"><strong>Total</strong><br/>' . $total . '</td></tr>' .
    (count($ticketLines) ? '<tr><td style="padding:4px 0;"><strong>Tickets</strong><br/>' . implode('<br/>', $ticketLines) . '</td></tr>' : '') .
    '</table>' .
    ($attendeeBlocks !== '' ? '<p style="margin:0 0 8px;font-weight:600;">Attendees</p><table width="100%">' . $attendeeBlocks . '</table>' : '') .
    $cta .
    '<p style="margin:24px 0 0;font-size:13px;color:#6b7280;">Show your QR code at the door for check-in. If you have questions, reply to this email.</p>' .
    '</td></tr></table></td></tr></table></body></html>';

  return send_email($buyerEmail, $subject, $bodyHtml, $pdo);
}
