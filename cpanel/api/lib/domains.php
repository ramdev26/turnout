<?php

function is_event_theme_id(string $id): bool {
  return array_key_exists($id, event_theme_catalog());
}

function event_theme_catalog(): array {
  return [
    'minimal' => ['primary' => '#0f766e', 'secondary' => '#64748b', 'templateId' => 'template-2'],
    'neo-green' => ['primary' => '#34d399', 'secondary' => '#10b981', 'templateId' => 'template-2'],
    'midnight' => ['primary' => '#818cf8', 'secondary' => '#a78bfa', 'templateId' => 'template-2'],
    'sunset' => ['primary' => '#f97316', 'secondary' => '#ec4899', 'templateId' => 'template-2'],
  ];
}

function normalize_event_hostname(string $host): string {
  $host = strtolower(trim($host));
  $host = preg_replace('#^https?://#', '', $host);
  $host = preg_replace('#/.*$#', '', $host);
  $host = preg_replace('#:\d+$#', '', $host);
  if (str_starts_with($host, 'www.')) {
    $host = substr($host, 4);
  }
  return $host;
}

function is_valid_event_hostname(string $host): bool {
  if ($host === '' || strlen($host) > 253) return false;
  if (!preg_match('/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/', $host)) {
    return false;
  }
  if (str_contains($host, '..')) return false;
  return true;
}

function domain_platform_hosts(): array {
  $cfg = get_config();
  $app = $cfg['domains'] ?? [];
  $raw = trim((string)($app['platform_hosts'] ?? ''));
  if ($raw === '') {
    $raw = trim((string)(getenv('PLATFORM_HOSTS') ?: ''));
  }
  $hosts = ['localhost', '127.0.0.1'];
  if ($raw !== '') {
    foreach (explode(',', $raw) as $h) {
      $h = normalize_event_hostname($h);
      if ($h !== '') $hosts[] = $h;
    }
  }
  $appBase = trim((string)(($cfg['payhere'] ?? [])['app_base_url'] ?? ''));
  if ($appBase !== '') {
    $baseHost = normalize_event_hostname(parse_url($appBase, PHP_URL_HOST) ?: '');
    if ($baseHost !== '') $hosts[] = $baseHost;
  }
  $vercelUrl = trim((string)(getenv('VERCEL_URL') ?: ''));
  if ($vercelUrl !== '') $hosts[] = normalize_event_hostname($vercelUrl);
  return array_values(array_unique($hosts));
}

function is_reserved_platform_host(string $host): bool {
  $host = normalize_event_hostname($host);
  if ($host === '') return true;
  if (in_array($host, domain_platform_hosts(), true)) return true;
  if (str_ends_with($host, '.vercel.app')) return true;
  return false;
}

function domain_cname_target(): string {
  $cfg = get_config();
  $domains = $cfg['domains'] ?? [];
  $target = trim((string)($domains['cname_target'] ?? ''));
  if ($target === '') $target = trim((string)(getenv('CUSTOM_DOMAIN_CNAME_TARGET') ?: ''));
  if ($target === '') $target = 'cname.vercel-dns.com';
  return $target;
}

function domain_apex_ip(): string {
  $cfg = get_config();
  $domains = $cfg['domains'] ?? [];
  $ip = trim((string)($domains['apex_ip'] ?? ''));
  if ($ip === '') $ip = trim((string)(getenv('CUSTOM_DOMAIN_APEX_IP') ?: ''));
  if ($ip === '') $ip = '76.76.21.21';
  return $ip;
}

function domain_dns_instructions(string $hostname): array {
  $hostname = normalize_event_hostname($hostname);
  $parts = explode('.', $hostname);
  $isApex = count($parts) === 2;
  $cnameTarget = domain_cname_target();
  $apexIp = domain_apex_ip();

  if ($isApex) {
    return [
      'hostname' => $hostname,
      'isApex' => true,
      'records' => [
        ['type' => 'A', 'name' => '@', 'value' => $apexIp, 'ttl' => 3600],
        ['type' => 'CNAME', 'name' => 'www', 'value' => $cnameTarget, 'ttl' => 3600],
      ],
      'note' => 'Point your root domain with an A record, and www with CNAME (recommended).',
    ];
  }

  $recordName = $parts[0];
  return [
    'hostname' => $hostname,
    'isApex' => false,
    'records' => [
      ['type' => 'CNAME', 'name' => $recordName, 'value' => $cnameTarget, 'ttl' => 3600],
    ],
    'note' => 'Create a CNAME record for your subdomain pointing to the target below.',
  ];
}

function ensure_events_custom_domain_column(PDO $pdo): void {
  static $done = false;
  if ($done) return;
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  try {
    if ($driver === 'mysql') {
      $stmt = $pdo->query("SHOW COLUMNS FROM events LIKE 'custom_domain'");
      if (!$stmt || !$stmt->fetch()) {
        $pdo->exec('ALTER TABLE events ADD COLUMN custom_domain VARCHAR(255) NULL');
      }
      $idx = $pdo->query("SHOW INDEX FROM events WHERE Key_name = 'uniq_events_custom_domain'");
      if (!$idx || !$idx->fetch()) {
        $pdo->exec('CREATE UNIQUE INDEX uniq_events_custom_domain ON events (custom_domain)');
      }
    } elseif ($driver === 'pgsql') {
      $pdo->exec('ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(255) NULL');
      $pdo->exec('CREATE UNIQUE INDEX IF NOT EXISTS uniq_events_custom_domain ON events (custom_domain) WHERE custom_domain IS NOT NULL');
    } else {
      $pdo->exec('ALTER TABLE events ADD COLUMN custom_domain TEXT NULL');
      $pdo->exec('CREATE UNIQUE INDEX IF NOT EXISTS uniq_events_custom_domain ON events(custom_domain) WHERE custom_domain IS NOT NULL');
    }
  } catch (Throwable $e) {
    // Non-fatal migration guard.
  }
  $done = true;
}

function sync_event_custom_domain(PDO $pdo, int $eventId, ?string $domain): void {
  ensure_events_custom_domain_column($pdo);
  $normalized = $domain !== null && trim($domain) !== '' ? normalize_event_hostname($domain) : null;
  if ($normalized === '') $normalized = null;

  if ($normalized !== null) {
    if (!is_valid_event_hostname($normalized)) json_response(400, ['error' => 'invalid_domain']);
    if (is_reserved_platform_host($normalized)) json_response(400, ['error' => 'domain_reserved']);
    $dup = $pdo->prepare('SELECT id FROM events WHERE custom_domain = ? AND id <> ? LIMIT 1');
    $dup->execute([$normalized, $eventId]);
    if ($dup->fetch()) json_response(409, ['error' => 'domain_taken']);
  }

  $upd = $pdo->prepare('UPDATE events SET custom_domain = ? WHERE id = ?');
  $upd->execute([$normalized, $eventId]);

  $stmt = $pdo->prepare('SELECT customization_json FROM events WHERE id = ? LIMIT 1');
  $stmt->execute([$eventId]);
  $row = $stmt->fetch();
  if ($row) {
    $customization = json_decode((string)$row['customization_json'], true);
    if (!is_array($customization)) $customization = [];
    if ($normalized === null) {
      unset($customization['customDomain'], $customization['dnsConfigured']);
    } else {
      $customization['customDomain'] = $normalized;
      $instructions = domain_dns_instructions($normalized);
      $customization['dnsRecordType'] = $instructions['records'][0]['type'] ?? 'CNAME';
      $customization['dnsRecordTarget'] = $instructions['records'][0]['value'] ?? domain_cname_target();
    }
    $pdo->prepare('UPDATE events SET customization_json = ? WHERE id = ?')->execute([
      json_encode($customization, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
      $eventId,
    ]);
  }
}

function vercel_domain_credentials(): ?array {
  $token = trim((string)(getenv('VERCEL_API_TOKEN') ?: getenv('VERCEL_TOKEN') ?: ''));
  $projectId = trim((string)(getenv('VERCEL_PROJECT_ID') ?: ''));
  $teamId = trim((string)(getenv('VERCEL_TEAM_ID') ?: ''));
  if ($token === '' || $projectId === '') return null;
  return ['token' => $token, 'projectId' => $projectId, 'teamId' => $teamId];
}

function vercel_api_request(string $method, string $path, ?array $body = null): array {
  $creds = vercel_domain_credentials();
  if ($creds === null) {
    return ['ok' => false, 'skipped' => true, 'message' => 'Vercel API not configured'];
  }

  $query = $creds['teamId'] !== '' ? ('?teamId=' . rawurlencode($creds['teamId'])) : '';
  $url = 'https://api.vercel.com' . $path . $query;
  $ch = curl_init($url);
  if ($ch === false) return ['ok' => false, 'error' => 'curl_init_failed'];

  $headers = [
    'Authorization: Bearer ' . $creds['token'],
    'Content-Type: application/json',
  ];
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_TIMEOUT => 20,
  ]);
  if ($body !== null) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
  }

  $raw = curl_exec($ch);
  $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);

  $data = null;
  if (is_string($raw) && $raw !== '') {
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) $data = $decoded;
  }

  return [
    'ok' => $status >= 200 && $status < 300,
    'status' => $status,
    'data' => $data,
    'error' => is_array($data) ? ($data['error']['message'] ?? $data['message'] ?? null) : null,
  ];
}

function vercel_add_project_domain(string $domain): array {
  $creds = vercel_domain_credentials();
  if ($creds === null) {
    return ['ok' => false, 'skipped' => true, 'message' => 'Set VERCEL_API_TOKEN and VERCEL_PROJECT_ID to auto-register domains.'];
  }
  $domain = normalize_event_hostname($domain);
  $res = vercel_api_request(
    'POST',
    '/v10/projects/' . rawurlencode($creds['projectId']) . '/domains',
    ['name' => $domain]
  );
  if ($res['ok']) return ['ok' => true, 'verified' => false, 'message' => 'Domain added to Vercel. Finish DNS at your registrar.'];
  if ((int)($res['status'] ?? 0) === 409) {
    return ['ok' => true, 'verified' => false, 'message' => 'Domain is already registered on this Vercel project.'];
  }
  return ['ok' => false, 'message' => (string)($res['error'] ?? 'Could not register domain on Vercel.')];
}

function vercel_get_project_domain(string $domain): array {
  $creds = vercel_domain_credentials();
  if ($creds === null) return ['ok' => false, 'skipped' => true];
  $domain = normalize_event_hostname($domain);
  $res = vercel_api_request(
    'GET',
    '/v9/projects/' . rawurlencode($creds['projectId']) . '/domains/' . rawurlencode($domain)
  );
  if (!$res['ok'] || !is_array($res['data'])) {
    return ['ok' => false, 'verified' => false, 'message' => 'Domain not found on Vercel yet.'];
  }
  $verified = (bool)($res['data']['verified'] ?? false);
  return [
    'ok' => true,
    'verified' => $verified,
    'message' => $verified ? 'Domain is verified on Vercel.' : 'Waiting for DNS verification on Vercel.',
    'data' => $res['data'],
  ];
}

function lookup_event_slug_by_host(PDO $pdo, string $host): ?string {
  ensure_events_custom_domain_column($pdo);
  $host = normalize_event_hostname($host);
  if ($host === '' || is_reserved_platform_host($host)) return null;

  $stmt = $pdo->prepare(
    "SELECT slug FROM events
     WHERE custom_domain = ?
       AND status = 'published'
       AND COALESCE(event_status, 'approved') = 'approved'
     LIMIT 1"
  );
  $stmt->execute([$host]);
  $row = $stmt->fetch();
  if ($row) return (string)$row['slug'];

  if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql') {
    $stmt2 = $pdo->prepare(
      "SELECT slug FROM events
       WHERE custom_domain = ? AND status = 'published' AND event_status = 'approved'
       LIMIT 1"
    );
    $stmt2->execute([$host]);
    $row2 = $stmt2->fetch();
    if ($row2) return (string)$row2['slug'];
  }

  return null;
}
