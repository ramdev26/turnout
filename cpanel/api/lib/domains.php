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
  // Brand-facing target (organizers should never need to see Vercel DNS hosts).
  if ($target === '') $target = 'domains.bigturnout.co';
  return strtolower(rtrim($target, '.'));
}

function domain_apex_ip(): string {
  $cfg = get_config();
  $domains = $cfg['domains'] ?? [];
  $ip = trim((string)($domains['apex_ip'] ?? ''));
  if ($ip === '') $ip = trim((string)(getenv('CUSTOM_DOMAIN_APEX_IP') ?: ''));
  if ($ip === '') $ip = '76.76.21.21';
  return $ip;
}

/** Hostnames we accept when verifying an organizer's CNAME. */
function domain_accepted_cname_targets(): array {
  $targets = [
    domain_cname_target(),
    'domains.bigturnout.co',
    'app.bigturnout.co',
    'cname.vercel-dns.com',
  ];
  return array_values(array_unique(array_filter(array_map(
    static fn ($h) => strtolower(rtrim(trim((string)$h), '.')),
    $targets
  ))));
}

function domain_cname_points_to_platform(string $value): bool {
  $val = strtolower(rtrim(trim($value), '.'));
  if ($val === '') return false;
  if (in_array($val, domain_accepted_cname_targets(), true)) return true;
  if (str_ends_with($val, '.vercel-dns.com')) return true;
  if (str_contains($val, 'vercel-dns')) return true;
  return false;
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
      'note' => 'Add these BigTurnout DNS records at your domain provider (A for the root, CNAME for www).',
    ];
  }

  $recordName = $parts[0];
  return [
    'hostname' => $hostname,
    'isApex' => false,
    'records' => [
      ['type' => 'CNAME', 'name' => $recordName, 'value' => $cnameTarget, 'ttl' => 3600],
    ],
    'note' => 'Create a CNAME record pointing your subdomain to BigTurnout.',
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

function sync_event_custom_domain(PDO $pdo, int $eventId, ?string $domain, ?string $path = null): void {
  ensure_events_custom_domain_column($pdo);
  $normalized = $domain !== null && trim($domain) !== '' ? normalize_event_hostname($domain) : null;
  if ($normalized === '') $normalized = null;
  $pathNorm = $path !== null && trim((string)$path) !== '' ? normalize_custom_domain_path($path) : null;

  $ownColumn = true;
  if ($normalized !== null) {
    if (!is_valid_event_hostname($normalized)) json_response(400, ['error' => 'invalid_domain']);
    if (is_reserved_platform_host($normalized)) json_response(400, ['error' => 'domain_reserved']);

    $dup = $pdo->prepare('SELECT id, slug, customization_json FROM events WHERE custom_domain = ? AND id <> ? LIMIT 1');
    $dup->execute([$normalized, $eventId]);
    $owner = $dup->fetch();
    if ($owner) {
      // Another event owns DNS for this host — join as a path sibling (e.g. /cc on same domain).
      if ($pathNorm === null) {
        json_response(409, [
          'error' => 'domain_taken',
          'message' => 'This domain is already used by another event. Add a short path (e.g. cc or tmb) to share it.',
        ]);
      }
      $ownColumn = false;
    }

    // Path must be unique among all events on this host.
    if ($pathNorm !== null) {
      foreach (list_events_for_custom_host($pdo, $normalized) as $peer) {
        if ((int)($peer['id'] ?? 0) === $eventId) continue;
        if (event_row_domain_path($peer) === $pathNorm) {
          json_response(409, [
            'error' => 'domain_path_taken',
            'message' => 'That path is already used on this domain. Pick another (e.g. tmb or cc).',
          ]);
        }
      }
    }
  }

  $columnValue = ($normalized !== null && $ownColumn) ? $normalized : null;
  // If we are joining as a sibling, leave our custom_domain column empty.
  // If clearing domain entirely, clear the column.
  if ($normalized === null) {
    $upd = $pdo->prepare('UPDATE events SET custom_domain = NULL WHERE id = ?');
    $upd->execute([$eventId]);
  } elseif ($ownColumn) {
    $upd = $pdo->prepare('UPDATE events SET custom_domain = ? WHERE id = ?');
    $upd->execute([$columnValue, $eventId]);
  } else {
    $upd = $pdo->prepare('UPDATE events SET custom_domain = NULL WHERE id = ?');
    $upd->execute([$eventId]);
  }

  $stmt = $pdo->prepare('SELECT customization_json FROM events WHERE id = ? LIMIT 1');
  $stmt->execute([$eventId]);
  $row = $stmt->fetch();
  if ($row) {
    $customization = json_decode((string)$row['customization_json'], true);
    if (!is_array($customization)) $customization = [];
    if ($normalized === null) {
      unset(
        $customization['customDomain'],
        $customization['customDomainPath'],
        $customization['dnsConfigured']
      );
    } else {
      $customization['customDomain'] = $normalized;
      if ($pathNorm !== null) $customization['customDomainPath'] = $pathNorm;
      else unset($customization['customDomainPath']);
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
    return ['ok' => false, 'skipped' => true, 'message' => 'Domain API not configured'];
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
    return ['ok' => false, 'skipped' => true, 'message' => 'Domain auto-registration is not configured. Add the DNS records below, then tap Check DNS.'];
  }
  $domain = normalize_event_hostname($domain);
  $res = vercel_api_request(
    'POST',
    '/v10/projects/' . rawurlencode($creds['projectId']) . '/domains',
    ['name' => $domain]
  );
  if ($res['ok']) return ['ok' => true, 'verified' => false, 'message' => 'Domain registered. Finish the DNS records below at your provider.'];
  if ((int)($res['status'] ?? 0) === 409) {
    return ['ok' => true, 'verified' => false, 'message' => 'Domain is already registered. Finish DNS at your provider if needed.'];
  }
  return ['ok' => false, 'message' => (string)($res['error'] ?? 'Could not register this domain.')];
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
    return ['ok' => false, 'verified' => false, 'message' => 'Domain is not active yet. Check DNS and try again.'];
  }
  $verified = (bool)($res['data']['verified'] ?? false);
  return [
    'ok' => true,
    'verified' => $verified,
    'message' => $verified ? 'Domain is verified and active.' : 'Waiting for DNS to verify. This can take a few minutes.',
    'data' => $res['data'],
  ];
}

/** Short public path on a shared custom domain (e.g. tmb, cc). */
function normalize_custom_domain_path(?string $path): ?string {
  $path = strtolower(trim((string)$path));
  $path = trim($path, '/');
  if ($path === '') return null;
  if (!preg_match('/^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$/', $path)) {
    json_response(400, [
      'error' => 'invalid_domain_path',
      'message' => 'Path must be 2–32 characters: letters, numbers, hyphens (e.g. tmb or cc).',
    ]);
  }
  $reserved = [
    'api', 'e', 'share', 'checkout', 'login', 'signup', 'dashboard', 'landing', 'discover',
    'attendee', 'staff', 'orders', 'payhere', 'assets', 'basadmin', 'admin', 'events',
    'public', 'domain', 'invite', 'www', 'static', 'cdn', 'health', 'status',
  ];
  if (in_array($path, $reserved, true)) {
    json_response(400, [
      'error' => 'domain_path_reserved',
      'message' => 'That path is reserved. Try something like tmb or cc.',
    ]);
  }
  return $path;
}

function event_customization_array(array $row): array {
  $raw = $row['customization_json'] ?? null;
  if (is_array($raw)) return $raw;
  if (!is_string($raw) || trim($raw) === '') return [];
  $decoded = json_decode($raw, true);
  // Handle accidental double-encoding.
  if (is_string($decoded)) {
    $decoded = json_decode($decoded, true);
  }
  return is_array($decoded) ? $decoded : [];
}

function event_row_domain_path(array $row): ?string {
  $customization = event_customization_array($row);
  $raw = trim((string)($customization['customDomainPath'] ?? ''));
  if ($raw === '') return null;
  $path = strtolower(trim($raw, '/'));
  if ($path === '' || !preg_match('/^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$/', $path)) return null;
  return $path;
}

function event_row_matches_host(array $row, string $host): bool {
  $host = normalize_event_hostname($host);
  $col = normalize_event_hostname((string)($row['custom_domain'] ?? ''));
  if ($col !== '' && $col === $host) return true;
  $customization = event_customization_array($row);
  $jsonHost = normalize_event_hostname((string)($customization['customDomain'] ?? ''));
  return $jsonHost !== '' && $jsonHost === $host;
}

/**
 * Events tied to a custom host (DNS owner column or customization.customDomain).
 *
 * @return list<array<string,mixed>>
 */
function list_events_for_custom_host(PDO $pdo, string $host): array {
  ensure_events_custom_domain_column($pdo);
  $host = normalize_event_hostname($host);
  if ($host === '') return [];

  $byId = [];
  $add = static function (array $row) use (&$byId, $host): void {
    $id = (int)($row['id'] ?? 0);
    if ($id <= 0 || isset($byId[$id])) return;
    if (event_row_matches_host($row, $host)) {
      $byId[$id] = $row;
    }
  };

  $ownerStmt = $pdo->prepare('SELECT * FROM events WHERE custom_domain = ?');
  $ownerStmt->execute([$host]);
  $organizerIds = [];
  foreach ($ownerStmt->fetchAll() as $row) {
    $add($row);
    $oid = (int)($row['organizer_user_id'] ?? 0);
    if ($oid > 0) $organizerIds[$oid] = true;
  }

  // Sibling path events usually share the organizer with the DNS owner.
  if ($organizerIds) {
    $ids = array_keys($organizerIds);
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    try {
      $sibStmt = $pdo->prepare(
        "SELECT * FROM events
         WHERE organizer_user_id IN ($placeholders)"
      );
      $sibStmt->execute($ids);
      foreach ($sibStmt->fetchAll() as $row) {
        $add($row);
      }
    } catch (Throwable $e) {
      error_log('[turnout] list_events_for_custom_host organizer scan failed: ' . $e->getMessage());
    }
  }

  // Always also scan customization_json for this host (path-only siblings).
  // Previously this only ran when no DNS owner existed — that skipped /cc.
  try {
    $like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $host) . '%';
    $jsonStmt = $pdo->prepare(
      "SELECT * FROM events
       WHERE customization_json IS NOT NULL
         AND customization_json LIKE ?"
    );
    $jsonStmt->execute([$like]);
    foreach ($jsonStmt->fetchAll() as $row) {
      $add($row);
    }
  } catch (Throwable $e) {
    error_log('[turnout] list_events_for_custom_host json scan failed: ' . $e->getMessage());
  }

  $rows = array_values($byId);
  usort($rows, static function ($a, $b) use ($host) {
    $aOwner = normalize_event_hostname((string)($a['custom_domain'] ?? '')) === $host ? 0 : 1;
    $bOwner = normalize_event_hostname((string)($b['custom_domain'] ?? '')) === $host ? 0 : 1;
    if ($aOwner !== $bOwner) return $aOwner <=> $bOwner;
    return ((int)($a['id'] ?? 0)) <=> ((int)($b['id'] ?? 0));
  });

  return $rows;
}

/**
 * Resolve a custom hostname to the default event slug plus optional path aliases.
 * @return array{slug:string,paths:array<string,string>}|null
 */
function lookup_host_event_map(PDO $pdo, string $host): ?array {
  $host = normalize_event_hostname($host);
  if ($host === '' || is_reserved_platform_host($host)) return null;

  $rows = list_events_for_custom_host($pdo, $host);
  if (!$rows) return null;

  $paths = [];
  $defaultSlug = null;
  foreach ($rows as $row) {
    $status = strtolower((string)($row['status'] ?? ''));
    $eventStatus = strtolower((string)($row['event_status'] ?? 'approved'));
    if ($status !== 'published') continue;
    if ($eventStatus !== '' && $eventStatus !== 'approved') continue;
    if (function_exists('is_event_publicly_visible') && !is_event_publicly_visible($row)) continue;

    $slug = trim((string)($row['slug'] ?? ''));
    if ($slug === '') continue;
    $path = event_row_domain_path($row);
    if ($path !== null) $paths[$path] = $slug;
    $col = normalize_event_hostname((string)($row['custom_domain'] ?? ''));
    if ($defaultSlug === null && $col === $host) $defaultSlug = $slug;
  }
  if ($defaultSlug === null) {
    $defaultSlug = $paths ? (string)reset($paths) : '';
  }
  if ($defaultSlug === '') return null;
  return ['slug' => $defaultSlug, 'paths' => $paths];
}

function lookup_event_slug_by_host(PDO $pdo, string $host): ?string {
  $map = lookup_host_event_map($pdo, $host);
  return $map['slug'] ?? null;
}

function lookup_event_slug_by_host_path(PDO $pdo, string $host, string $path): ?string {
  $map = lookup_host_event_map($pdo, $host);
  if ($map === null) return null;
  $path = strtolower(trim($path, '/'));
  if ($path !== '' && isset($map['paths'][$path])) return $map['paths'][$path];
  return null;
}
