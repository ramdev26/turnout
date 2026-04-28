<?php

function send_email(string $to, string $subject, string $htmlBody): bool {
  $cfg = get_config();
  $mail = $cfg['mail'] ?? [];
  $enabled = (bool)($mail['enabled'] ?? false);
  if (!$enabled) return true;

  $from = (string)($mail['from'] ?? '');
  if ($from === '') return false;

  $headers = [];
  $headers[] = 'MIME-Version: 1.0';
  $headers[] = 'Content-type: text/html; charset=utf-8';
  $headers[] = 'From: ' . $from;

  return mail($to, $subject, $htmlBody, implode("\r\n", $headers));
}

