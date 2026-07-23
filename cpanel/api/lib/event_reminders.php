<?php

/**
 * Virtual (online) event reminders — email + SMS ~15 minutes before start.
 */

const EVENT_REMINDER_ONLINE_15M = 'online_15m';

function ensure_event_reminders_table(PDO $pdo): void {
  static $checked = false;
  if ($checked) return;
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);

  if ($driver === 'sqlite') {
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS event_reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        reminder_key TEXT NOT NULL,
        emails_sent INTEGER NOT NULL DEFAULT 0,
        sms_sent INTEGER NOT NULL DEFAULT 0,
        sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id, reminder_key)
      )'
    );
  } elseif ($driver === 'pgsql') {
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS event_reminders (
        id BIGSERIAL PRIMARY KEY,
        event_id BIGINT NOT NULL,
        reminder_key VARCHAR(64) NOT NULL,
        emails_sent INT NOT NULL DEFAULT 0,
        sms_sent INT NOT NULL DEFAULT 0,
        sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id, reminder_key)
      )'
    );
  } else {
    $pdo->exec(
      "CREATE TABLE IF NOT EXISTS event_reminders (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        event_id BIGINT UNSIGNED NOT NULL,
        reminder_key VARCHAR(64) NOT NULL,
        emails_sent INT NOT NULL DEFAULT 0,
        sms_sent INT NOT NULL DEFAULT 0,
        sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_event_reminder (event_id, reminder_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
  }
  $checked = true;
}

function require_cron_access(): void {
  $cfg = get_config();
  $secret = trim((string)(($cfg['cron']['secret'] ?? '') ?: (getenv('CRON_SECRET') ?: '')));
  $vercelCron = trim((string)($_SERVER['HTTP_X_VERCEL_CRON'] ?? ''));
  if ($vercelCron === '1') {
    return;
  }

  $auth = trim((string)($_SERVER['HTTP_AUTHORIZATION'] ?? ''));
  $bearer = '';
  if (preg_match('/^Bearer\s+(.+)$/i', $auth, $m)) {
    $bearer = trim($m[1]);
  }
  $querySecret = trim((string)($_GET['secret'] ?? ''));

  if ($secret !== '') {
    if ($bearer !== '' && hash_equals($secret, $bearer)) return;
    if ($querySecret !== '' && hash_equals($secret, $querySecret)) return;
    json_response(401, ['error' => 'unauthorized', 'message' => 'Invalid cron secret.']);
  }

  // No secret configured — allow only in explicit app dev mode.
  $dev = !empty($cfg['app']['dev_mode']);
  if ($dev) return;

  json_response(401, [
    'error' => 'cron_secret_required',
    'message' => 'Set CRON_SECRET and pass Authorization: Bearer <secret>.',
  ]);
}

function event_online_join_meta(array $eventRow): ?array {
  $customization = json_decode((string)($eventRow['customization_json'] ?? ''), true);
  if (!is_array($customization)) $customization = [];
  if (!empty($customization['scheduleTba'])) {
    return null;
  }
  if (($customization['locationMode'] ?? 'physical') !== 'online') {
    return null;
  }
  $url = trim((string)($customization['onlineUrl'] ?? ''));
  if ($url === '' || !filter_var($url, FILTER_VALIDATE_URL) || !preg_match('#^https?://#i', $url)) {
    return null;
  }
  $platform = trim((string)($customization['onlinePlatform'] ?? 'other'));
  $platformLabels = [
    'google_meet' => 'Google Meet',
    'zoom' => 'Zoom',
    'youtube' => 'YouTube',
    'other' => 'Online',
  ];
  return [
    'url' => $url,
    'platform' => $platform,
    'platformLabel' => $platformLabels[$platform] ?? 'Online',
  ];
}

function claim_event_reminder(PDO $pdo, int $eventId, string $reminderKey): bool {
  ensure_event_reminders_table($pdo);
  try {
    $stmt = $pdo->prepare(
      'INSERT INTO event_reminders (event_id, reminder_key, emails_sent, sms_sent) VALUES (?, ?, 0, 0)'
    );
    $stmt->execute([$eventId, $reminderKey]);
    return true;
  } catch (Throwable $e) {
    // Unique constraint — already claimed/sent.
    return false;
  }
}

function update_event_reminder_counts(PDO $pdo, int $eventId, string $reminderKey, int $emails, int $sms): void {
  $stmt = $pdo->prepare(
    'UPDATE event_reminders SET emails_sent = ?, sms_sent = ? WHERE event_id = ? AND reminder_key = ?'
  );
  $stmt->execute([$emails, $sms, $eventId, $reminderKey]);
}

function reminder_cron_lock_get(PDO $pdo): int {
  if (!function_exists('get_global_setting')) {
    return 0;
  }
  $raw = trim((string)(get_global_setting($pdo, 'event_reminders_last_run', '0') ?? '0'));
  return ctype_digit($raw) ? (int)$raw : 0;
}

function reminder_cron_lock_touch(PDO $pdo): void {
  $now = (string)time();
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  try {
    if ($driver === 'pgsql') {
      $stmt = $pdo->prepare(
        'INSERT INTO global_settings (setting_key, setting_value) VALUES (?, ?)
         ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value'
      );
      $stmt->execute(['event_reminders_last_run', $now]);
    } elseif ($driver === 'sqlite') {
      $stmt = $pdo->prepare(
        'INSERT INTO global_settings (setting_key, setting_value) VALUES (?, ?)
         ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value'
      );
      $stmt->execute(['event_reminders_last_run', $now]);
    } else {
      $stmt = $pdo->prepare(
        'INSERT INTO global_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)'
      );
      $stmt->execute(['event_reminders_last_run', $now]);
    }
  } catch (Throwable $e) {
    // Ignore lock write failures.
  }
}

/**
 * Run reminders at most once every $minIntervalSeconds (used from /health and cron).
 *
 * @return array<string,mixed>|null
 */
function maybe_process_online_event_reminders(PDO $pdo, int $minIntervalSeconds = 180): ?array {
  $last = reminder_cron_lock_get($pdo);
  if ($last > 0 && (time() - $last) < $minIntervalSeconds) {
    return null;
  }
  reminder_cron_lock_touch($pdo);
  return process_online_event_reminders($pdo, 10, 20);
}

/**
 * @return list<array{email:?string,phone:?string,fullName:string}>
 */
function load_event_reminder_recipients(PDO $pdo, int $eventId): array {
  $stmt = $pdo->prepare(
    "SELECT a.full_name, a.email, a.phone
     FROM attendees a
     INNER JOIN orders o ON o.id = a.order_id
     WHERE a.event_id = ? AND o.status = 'paid'
     ORDER BY a.id ASC"
  );
  $stmt->execute([$eventId]);

  $byEmail = [];
  $byPhone = [];
  $out = [];
  while ($row = $stmt->fetch()) {
    $email = strtolower(trim((string)($row['email'] ?? '')));
    $phone = trim((string)($row['phone'] ?? ''));
    $name = trim((string)($row['full_name'] ?? ''));
    $emailOk = $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL);
    $phoneNorm = $phone !== '' ? sms_normalize_contact($phone) : null;

    // Prefer one row per person (email first, else phone).
    if ($emailOk && isset($byEmail[$email])) continue;
    if (!$emailOk && $phoneNorm && isset($byPhone[$phoneNorm])) continue;

    if ($emailOk) $byEmail[$email] = true;
    if ($phoneNorm) $byPhone[$phoneNorm] = true;

    $out[] = [
      'email' => $emailOk ? $email : null,
      'phone' => $phoneNorm,
      'fullName' => $name !== '' ? $name : 'there',
    ];
  }
  return $out;
}

function send_online_event_reminder_email(
  PDO $pdo,
  string $toEmail,
  string $recipientName,
  array $eventRow,
  array $joinMeta
): bool {
  $title = (string)($eventRow['title'] ?? 'your event');
  $safeTitle = htmlspecialchars($title);
  $safeName = htmlspecialchars($recipientName !== '' ? $recipientName : 'there');
  $platform = htmlspecialchars((string)$joinMeta['platformLabel']);
  $url = (string)$joinMeta['url'];
  $safeUrl = htmlspecialchars($url);
  $when = '';
  $ts = strtotime((string)($eventRow['event_date'] ?? ''));
  if ($ts !== false) {
    $when = gmdate('D, M j · H:i', $ts) . ' UTC';
  }

  $inner =
    '<p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Hi ' . $safeName . ',</p>' .
    '<p style="margin:0 0 18px;font-size:15px;line-height:1.5;color:#e9f4ee;">' .
    'Your virtual event <strong style="color:#ffffff;">' . $safeTitle . '</strong> starts in about <strong style="color:#c0ff72;">15 minutes</strong>.</p>' .
    mail_event_details_block(
      $safeTitle,
      htmlspecialchars($when),
      $platform . ' · virtual event',
      '<div style="margin-top:12px;font-size:14px;color:#e9f4ee;"><strong style="color:#c0ff72;">Join link</strong><br/>' .
      '<a href="' . $safeUrl . '" style="color:#c0ff72;word-break:break-all;">' . $safeUrl . '</a></div>'
    ) .
    mail_cta_button($url, 'Join ' . (string)$joinMeta['platformLabel'] . ' now') .
    '<p style="margin:20px 0 0;font-size:13px;color:#93b5b7;line-height:1.5;">Open the link a few minutes early so you are ready when the host starts.</p>';

  $subject = 'Starting soon — ' . $title;
  return send_email($toEmail, $subject, mail_turnout_layout('Event starts in 15 minutes', $inner), $pdo);
}

function send_online_event_reminder_sms(string $phone, string $eventTitle, string $joinUrl): bool {
  if (!sms_enabled()) return false;
  $title = trim($eventTitle);
  if (mb_strlen($title) > 60) {
    $title = mb_substr($title, 0, 57) . '...';
  }
  $message = 'Reminder: "' . $title . '" starts in 15 min. Join: ' . $joinUrl . ' — Turnout';
  if (mb_strlen($message) > 400) {
    $message = mb_substr($message, 0, 400);
  }
  return send_sms($phone, $message);
}

/**
 * Find published online events starting ~15 minutes from now and notify attendees.
 *
 * @return array{checked:int,sent:int,skipped:int,emails:int,sms:int,events:list<array>}
 */
function process_online_event_reminders(PDO $pdo, int $windowStartMinutes = 10, int $windowEndMinutes = 20): array {
  ensure_event_reminders_table($pdo);
  if ($windowStartMinutes < 1) $windowStartMinutes = 1;
  if ($windowEndMinutes <= $windowStartMinutes) $windowEndMinutes = $windowStartMinutes + 10;

  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  // Compute window in PHP (UTC) so SQLite/MySQL/Postgres behave the same.
  $now = time();
  $windowStart = gmdate('Y-m-d H:i:s', $now + ($windowStartMinutes * 60));
  $windowEnd = gmdate('Y-m-d H:i:s', $now + ($windowEndMinutes * 60));

  if ($driver === 'sqlite') {
    $stmt = $pdo->prepare(
      "SELECT e.*
       FROM events e
       WHERE e.status = 'published'
         AND COALESCE(e.event_status, 'approved') = 'approved'
         AND datetime(e.event_date) > datetime(?)
         AND datetime(e.event_date) <= datetime(?)
       ORDER BY e.event_date ASC
       LIMIT 50"
    );
  } else {
    $stmt = $pdo->prepare(
      "SELECT e.*
       FROM events e
       WHERE e.status = 'published'
         AND COALESCE(e.event_status, 'approved') = 'approved'
         AND e.event_date > ?
         AND e.event_date <= ?
       ORDER BY e.event_date ASC
       LIMIT 50"
    );
  }
  $stmt->execute([$windowStart, $windowEnd]);

  $summary = [
    'checked' => 0,
    'sent' => 0,
    'skipped' => 0,
    'emails' => 0,
    'sms' => 0,
    'events' => [],
  ];

  while ($event = $stmt->fetch()) {
    $summary['checked']++;
    $eventId = (int)$event['id'];
    $joinMeta = event_online_join_meta($event);
    if ($joinMeta === null) {
      $summary['skipped']++;
      continue;
    }

    if (!claim_event_reminder($pdo, $eventId, EVENT_REMINDER_ONLINE_15M)) {
      $summary['skipped']++;
      continue;
    }

    $recipients = load_event_reminder_recipients($pdo, $eventId);
    $emailsSent = 0;
    $smsSent = 0;
    foreach ($recipients as $r) {
      if (!empty($r['email'])) {
        try {
          if (send_online_event_reminder_email($pdo, (string)$r['email'], (string)$r['fullName'], $event, $joinMeta)) {
            $emailsSent++;
          }
        } catch (Throwable $e) {
          error_log(sprintf('[turnout] online reminder email failed event=%d: %s', $eventId, $e->getMessage()));
        }
      }
      if (!empty($r['phone'])) {
        try {
          if (send_online_event_reminder_sms((string)$r['phone'], (string)$event['title'], (string)$joinMeta['url'])) {
            $smsSent++;
          }
        } catch (Throwable $e) {
          error_log(sprintf('[turnout] online reminder SMS failed event=%d: %s', $eventId, $e->getMessage()));
        }
      }
    }

    update_event_reminder_counts($pdo, $eventId, EVENT_REMINDER_ONLINE_15M, $emailsSent, $smsSent);
    $summary['sent']++;
    $summary['emails'] += $emailsSent;
    $summary['sms'] += $smsSent;
    $summary['events'][] = [
      'eventId' => (string)$eventId,
      'title' => (string)$event['title'],
      'recipients' => count($recipients),
      'emailsSent' => $emailsSent,
      'smsSent' => $smsSent,
    ];
  }

  return $summary;
}
