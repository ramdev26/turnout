<?php

function app_base_url(): string {
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

function public_api_url(string $path): string {
  $path = '/' . ltrim($path, '/');
  $base = app_base_url();
  return $base !== '' ? $base . $path : $path;
}

function banner_allowed_mime_types(): array {
  return [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
    'image/gif' => 'gif',
  ];
}

function parse_blob_store_id_from_token(string $token): string {
  $parts = explode('_', $token);
  $storeId = trim((string)($parts[3] ?? ''));
  if ($storeId === '') {
    return '';
  }
  if (str_starts_with($storeId, 'store_')) {
    return substr($storeId, strlen('store_'));
  }
  return $storeId;
}

function banner_local_upload_dir(): ?string {
  $preferred = dirname(__DIR__) . '/uploads/banners';
  if (is_dir($preferred) && is_writable($preferred)) {
    return $preferred;
  }
  if (!is_dir($preferred)) {
    @mkdir($preferred, 0775, true);
  }
  if (is_dir($preferred) && is_writable($preferred)) {
    return $preferred;
  }

  $tmp = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'turnout-banners';
  if (!is_dir($tmp)) {
    @mkdir($tmp, 0775, true);
  }
  if (is_dir($tmp) && is_writable($tmp)) {
    return $tmp;
  }

  return null;
}

function detect_banner_mime(string $tmpPath, array $file): string {
  if (function_exists('finfo_open')) {
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    if ($finfo) {
      $mime = (string)finfo_file($finfo, $tmpPath);
      finfo_close($finfo);
      if ($mime !== '') {
        return $mime;
      }
    }
  }

  return trim((string)($file['type'] ?? ''));
}

function try_upload_banner_to_vercel_blob(string $filePath, string $mime, string $ext): ?string {
  $token = trim((string)(getenv('BLOB_READ_WRITE_TOKEN') ?: ''));
  if ($token === '' || !function_exists('curl_init')) {
    return null;
  }

  $storeId = trim((string)(getenv('BLOB_STORE_ID') ?: ''));
  if ($storeId === '') {
    $storeId = parse_blob_store_id_from_token($token);
  }
  if ($storeId !== '' && str_starts_with($storeId, 'store_')) {
    $storeId = substr($storeId, strlen('store_'));
  }
  if ($storeId === '') {
    return null;
  }

  $bytes = file_get_contents($filePath);
  if ($bytes === false || $bytes === '') {
    return null;
  }

  $pathname = 'event-banners/' . bin2hex(random_bytes(12)) . '.' . $ext;
  $baseUrl = trim((string)(getenv('VERCEL_BLOB_API_URL') ?: ''));
  if ($baseUrl === '') {
    $baseUrl = 'https://vercel.com/api/blob';
  }

  $url = rtrim($baseUrl, '/') . '/?' . http_build_query(['pathname' => $pathname]);
  $apiVersion = (int)(getenv('VERCEL_BLOB_API_VERSION_OVERRIDE') ?: 12);

  $ch = curl_init($url);
  if ($ch === false) {
    return null;
  }

  curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST => 'PUT',
    CURLOPT_POSTFIELDS => $bytes,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_HTTPHEADER => [
      'Authorization: Bearer ' . $token,
      'x-api-version: ' . $apiVersion,
      'x-vercel-blob-store-id: ' . $storeId,
      'x-vercel-blob-access: public',
      'x-content-type: ' . $mime,
      'x-content-length: ' . strlen($bytes),
      'x-add-random-suffix: 1',
      'Content-Type: ' . $mime,
    ],
  ]);

  $response = curl_exec($ch);
  $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);

  if ($status < 200 || $status >= 300 || !is_string($response) || $response === '') {
    error_log(sprintf('[turnout][%s] blob upload failed status=%d pathname=%s', request_id(), $status, $pathname));
    return null;
  }

  $decoded = json_decode($response, true);
  if (!is_array($decoded)) {
    return null;
  }

  $blobUrl = trim((string)($decoded['url'] ?? $decoded['downloadUrl'] ?? ''));
  return $blobUrl !== '' ? $blobUrl : null;
}

function save_banner_locally(string $tmpPath, string $ext): ?string {
  $uploadDir = banner_local_upload_dir();
  if ($uploadDir === null) {
    return null;
  }

  $name = bin2hex(random_bytes(12)) . '.' . $ext;
  $target = $uploadDir . DIRECTORY_SEPARATOR . $name;

  if (is_uploaded_file($tmpPath)) {
    if (!@move_uploaded_file($tmpPath, $target)) {
      return null;
    }
    return $name;
  }

  if (!@copy($tmpPath, $target)) {
    return null;
  }

  return $name;
}

function serve_local_banner_file(string $filename): void {
  if (!preg_match('/^[a-f0-9]{24}\.(jpg|jpeg|png|webp|gif)$/i', $filename)) {
    json_response(404, ['error' => 'not_found']);
  }

  $uploadDir = banner_local_upload_dir();
  if ($uploadDir === null) {
    json_response(404, ['error' => 'not_found']);
  }

  $path = $uploadDir . DIRECTORY_SEPARATOR . $filename;
  if (!is_file($path)) {
    json_response(404, ['error' => 'not_found']);
  }

  $ext = strtolower((string)pathinfo($filename, PATHINFO_EXTENSION));
  $mime = match ($ext) {
    'jpg', 'jpeg' => 'image/jpeg',
    'png' => 'image/png',
    'webp' => 'image/webp',
    'gif' => 'image/gif',
    default => 'application/octet-stream',
  };

  http_response_code(200);
  header('Content-Type: ' . $mime);
  header('Cache-Control: public, max-age=31536000, immutable');
  readfile($path);
  exit;
}

function handle_banner_upload_post(): void {
  require_organizer_user_id();

  if (!isset($_FILES['file'])) {
    json_response(400, ['error' => 'missing_file']);
  }

  $file = $_FILES['file'];
  if (!is_array($file) || (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK)) {
    json_response(400, ['error' => 'upload_failed']);
  }

  $tmpPath = (string)($file['tmp_name'] ?? '');
  if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
    json_response(400, ['error' => 'invalid_upload']);
  }

  $size = (int)($file['size'] ?? 0);
  if ($size <= 0 || $size > (5 * 1024 * 1024)) {
    json_response(400, ['error' => 'file_too_large']);
  }

  $mime = detect_banner_mime($tmpPath, $file);
  $allowed = banner_allowed_mime_types();
  $ext = $allowed[$mime] ?? null;
  if ($ext === null) {
    json_response(400, ['error' => 'unsupported_file_type']);
  }

  $blobUrl = try_upload_banner_to_vercel_blob($tmpPath, $mime, $ext);
  if ($blobUrl !== null) {
    json_response(201, ['bannerUrl' => $blobUrl]);
  }

  $name = save_banner_locally($tmpPath, $ext);
  if ($name === null) {
    $hasBlobToken = trim((string)(getenv('BLOB_READ_WRITE_TOKEN') ?: '')) !== '';
    json_response(500, [
      'error' => $hasBlobToken ? 'blob_upload_failed' : 'upload_storage_unavailable',
      'message' => $hasBlobToken
        ? 'Banner upload to Vercel Blob failed. Confirm the Blob store is linked to this project and redeploy.'
        : 'Banner upload storage is not configured. Add a Vercel Blob store (BLOB_READ_WRITE_TOKEN) and redeploy.',
    ]);
  }

  $relative = '/api/uploads/banners/' . $name;
  json_response(201, ['bannerUrl' => public_api_url($relative)]);
}
