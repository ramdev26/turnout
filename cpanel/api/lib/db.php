<?php

require_once __DIR__ . '/env.php';

function get_config(): array {
  static $cfg = null;
  if ($cfg !== null) return $cfg;

  load_dotenv_if_present();

  $configPath = null;
  foreach (['config.php', 'config.vercel.php', 'config.sample.php'] as $name) {
    $candidate = __DIR__ . '/../' . $name;
    if (file_exists($candidate)) {
      $configPath = $candidate;
      break;
    }
  }
  if ($configPath === null) {
    json_response(500, [
      'error' => 'server_not_configured',
      'message' => 'Missing api/config.php. Copy config.sample.php to config.php and set DB credentials.',
      'sample' => 'config.sample.php',
    ]);
  }

  $cfg = require $configPath;
  if (!is_array($cfg)) {
    json_response(500, ['error' => 'invalid_config']);
  }
  return $cfg;
}

/**
 * Parse SSL / channel_binding options from a DATABASE_URL query string.
 * Neon / Vercel Postgres require SSL; without sslmode PDO often fails open.
 *
 * @return array{sslmode:?string,channel_binding:?string}
 */
function db_url_ssl_options(string $dbUrl): array {
  $sslmode = null;
  $channelBinding = null;
  $query = parse_url($dbUrl, PHP_URL_QUERY);
  if (is_string($query) && $query !== '') {
    parse_str($query, $params);
    if (isset($params['sslmode']) && is_string($params['sslmode']) && $params['sslmode'] !== '') {
      $sslmode = $params['sslmode'];
    }
    if (isset($params['channel_binding']) && is_string($params['channel_binding']) && $params['channel_binding'] !== '') {
      $channelBinding = $params['channel_binding'];
    }
  }
  $envSsl = trim((string)(getenv('PGSSLMODE') ?: getenv('DB_SSLMODE') ?: ''));
  if ($sslmode === null && $envSsl !== '') {
    $sslmode = $envSsl;
  }
  return [
    'sslmode' => $sslmode,
    'channel_binding' => $channelBinding,
  ];
}

function pgsql_dsn(
  string $host,
  string $name,
  int $port,
  string $charset,
  ?string $sslmode,
  ?string $channelBinding = null,
  bool $preferSsl = false
): string {
  $dsn = "pgsql:host={$host};dbname={$name}";
  if ($port > 0) {
    $dsn .= ";port={$port}";
  }
  if ($charset !== '') {
    $dsn .= ";options='--client_encoding={$charset}'";
  }
  // Managed Postgres (Neon/Vercel) rejects non-SSL connections.
  if (($sslmode === null || $sslmode === '') && $preferSsl) {
    $sslmode = 'require';
  }
  if ($sslmode !== null && $sslmode !== '') {
    $dsn .= ';sslmode=' . $sslmode;
  }
  if ($channelBinding !== null && $channelBinding !== '') {
    $dsn .= ';channel_binding=' . $channelBinding;
  }
  return $dsn;
}

function db(): PDO {
  static $pdo = null;
  if ($pdo !== null) return $pdo;

  $cfg = get_config();
  $db = $cfg['db'] ?? null;
  if (!is_array($db)) json_response(500, ['error' => 'invalid_config_db']);

  $driver = $db['driver'] ?? 'mysql';
  if ($driver === 'sqlite') {
    $path = $db['path'] ?? (__DIR__ . '/../data/dev.sqlite');
    $dir = dirname($path);
    if (!is_dir($dir)) {
      @mkdir($dir, 0777, true);
    }

    $isNew = !file_exists($path);
    $pdo = new PDO('sqlite:' . $path, null, null, [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
      PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    if ($isNew) {
      $schemaPath = __DIR__ . '/../../schema.sqlite.sql';
      if (file_exists($schemaPath)) {
        $sql = file_get_contents($schemaPath);
        if (is_string($sql) && trim($sql) !== '') {
          $pdo->exec($sql);
        }
      }
    }

    return $pdo;
  }

  $host = (string)($db['host'] ?? 'localhost');
  $name = (string)($db['name'] ?? '');
  $user = (string)($db['user'] ?? '');
  $pass = (string)($db['pass'] ?? '');
  $charset = (string)($db['charset'] ?? 'utf8mb4');
  $sslmode = null;
  $channelBinding = null;
  $port = 0;

  $dbUrl = trim((string)($db['url'] ?? ''));
  if ($dbUrl !== '') {
    $parts = parse_url($dbUrl);
    if (!is_array($parts)) json_response(500, ['error' => 'invalid_config_db_url']);
    $scheme = strtolower((string)($parts['scheme'] ?? ''));
    $host = (string)($parts['host'] ?? $host);
    $port = (int)($parts['port'] ?? 0);
    $name = ltrim((string)($parts['path'] ?? ''), '/');
    // Strip accidental query leftovers from path (defensive).
    if (str_contains($name, '?')) {
      $name = explode('?', $name, 2)[0];
    }
    if (array_key_exists('user', $parts)) {
      $user = rawurldecode((string)$parts['user']);
    }
    if (array_key_exists('pass', $parts)) {
      $pass = rawurldecode((string)$parts['pass']);
    }
    $ssl = db_url_ssl_options($dbUrl);
    $sslmode = $ssl['sslmode'];
    $channelBinding = $ssl['channel_binding'];

    if ($scheme === 'postgres' || $scheme === 'postgresql') {
      $driver = 'pgsql';
      if ($charset === '' || strtolower($charset) === 'utf8mb4') $charset = 'UTF8';
      $preferSsl = str_contains($host, 'neon.tech')
        || str_contains($host, 'vercel-storage.com')
        || str_contains($host, 'supabase.co')
        || str_contains($host, 'amazonaws.com')
        || true; // DATABASE_URL-backed Postgres is almost always TLS-required
      $dsn = pgsql_dsn($host, $name, $port, $charset, $sslmode, $channelBinding, $preferSsl);
      $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
      ]);
      return $pdo;
    }
    if ($scheme === 'mysql') {
      $driver = 'mysql';
      if ($port > 0) $host .= ':' . $port;
    }
  }

  if ($driver === 'pgsql') {
    if ($name === '' || $user === '') json_response(500, ['error' => 'invalid_config_db_credentials']);
    if ($charset === '' || strtolower($charset) === 'utf8mb4') $charset = 'UTF8';
    if ($sslmode === null) {
      $ssl = db_url_ssl_options('');
      $sslmode = $ssl['sslmode'];
    }
    $dsn = pgsql_dsn($host, $name, $port, $charset, $sslmode, $channelBinding);
    $pdo = new PDO($dsn, $user, $pass, [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    return $pdo;
  }

  if ($name === '' || $user === '') json_response(500, ['error' => 'invalid_config_db_credentials']);
  $dsn = "mysql:host={$host};dbname={$name};charset={$charset}";
  $pdo = new PDO($dsn, $user, $pass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
  ]);

  return $pdo;
}
