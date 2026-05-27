<?php

function get_config(): array {
  static $cfg = null;
  if ($cfg !== null) return $cfg;

  $configPath = __DIR__ . '/../config.php';
  if (!file_exists($configPath)) {
    $configPath = __DIR__ . '/../config.sample.php';
  }
  if (!file_exists($configPath)) {
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

  $dbUrl = trim((string)($db['url'] ?? ''));
  if ($dbUrl !== '') {
    $parts = parse_url($dbUrl);
    if (!is_array($parts)) json_response(500, ['error' => 'invalid_config_db_url']);
    $scheme = strtolower((string)($parts['scheme'] ?? ''));
    $host = (string)($parts['host'] ?? $host);
    $port = (int)($parts['port'] ?? 0);
    $name = ltrim((string)($parts['path'] ?? ''), '/');
    $user = (string)($parts['user'] ?? $user);
    $pass = (string)($parts['pass'] ?? $pass);
    if ($scheme === 'postgres' || $scheme === 'postgresql') {
      $driver = 'pgsql';
      if ($charset === '' || strtolower($charset) === 'utf8mb4') $charset = 'UTF8';
      $dsn = "pgsql:host={$host};dbname={$name}";
      if ($port > 0) $dsn .= ";port={$port}";
      if ($charset !== '') $dsn .= ";options='--client_encoding={$charset}'";
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
    $dsn = "pgsql:host={$host};dbname={$name}";
    if ($charset !== '') $dsn .= ";options='--client_encoding={$charset}'";
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

