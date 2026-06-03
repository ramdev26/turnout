<?php

/**
 * Load project .env into getenv() when vars are not already set (Vercel env, shell, etc.).
 */
function load_dotenv_if_present(): void {
  static $loaded = false;
  if ($loaded) {
    return;
  }
  $loaded = true;

  $candidates = [
    dirname(__DIR__, 3) . '/.env',
    dirname(__DIR__, 2) . '/.env',
  ];

  foreach ($candidates as $path) {
    if (!is_readable($path)) {
      continue;
    }
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
      continue;
    }
    foreach ($lines as $line) {
      $line = trim($line);
      if ($line === '' || str_starts_with($line, '#')) {
        continue;
      }
      if (!str_contains($line, '=')) {
        continue;
      }
      [$key, $value] = explode('=', $line, 2);
      $key = trim($key);
      $value = trim($value);
      if ($key === '') {
        continue;
      }
      if ((getenv($key) ?: '') === '') {
        putenv($key . '=' . $value);
        $_ENV[$key] = $value;
      }
    }
    break;
  }
}
