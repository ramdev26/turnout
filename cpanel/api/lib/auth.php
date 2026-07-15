<?php



function auth_cookie_name(): string {

  $cfg = get_config();

  $s = $cfg['session'] ?? [];

  $baseName = (string)($s['name'] ?? 'turnout_sess');

  return $baseName . '_auth';

}



function auth_signing_key(): string {

  $cfg = get_config();

  $sessionCfg = $cfg['session'] ?? [];

  $explicitSecret = trim((string)($sessionCfg['token_secret'] ?? ''));

  if ($explicitSecret !== '' && $explicitSecret !== 'CHANGE_ME_LONG_RANDOM_SECRET') {

    return $explicitSecret;

  }



  // Deterministic fallback so serverless instances can verify each other's tokens.

  $db = $cfg['db'] ?? [];

  $parts = [

    (string)($db['host'] ?? ''),

    (string)($db['name'] ?? ''),

    (string)($db['user'] ?? ''),

    (string)($db['pass'] ?? ''),

    (string)($db['url'] ?? ''),

  ];

  return hash('sha256', implode('|', $parts));

}



function auth_cookie_options(): array {

  $cfg = get_config();

  $s = $cfg['session'] ?? [];

  $samesite = (string)($s['cookie_samesite'] ?? 'Lax');

  if (!in_array($samesite, ['Lax', 'Strict', 'None'], true)) {

    $samesite = 'Lax';

  }

  $opts = [

    'expires' => 0,

    'path' => '/',

    'secure' => (bool)($s['cookie_secure'] ?? false),

    'httponly' => (bool)($s['cookie_httponly'] ?? true),

    'samesite' => $samesite,

  ];

  $domain = trim((string)($s['cookie_domain'] ?? ''));

  if ($domain !== '') {

    $opts['domain'] = $domain;

  }

  return $opts;

}



function b64url_encode(string $raw): string {

  return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');

}



function b64url_decode(string $encoded): ?string {

  $normalized = strtr($encoded, '-_', '+/');

  $pad = strlen($normalized) % 4;

  if ($pad > 0) {

    $normalized .= str_repeat('=', 4 - $pad);

  }

  $decoded = base64_decode($normalized, true);

  if ($decoded === false) {

    return null;

  }

  return $decoded;

}



function issue_auth_token(int $userId): string {

  $now = time();

  $payload = [

    'uid' => $userId,

    'iat' => $now,

    'exp' => $now + (60 * 60 * 24 * 7),

  ];

  $json = json_encode($payload, JSON_UNESCAPED_SLASHES);

  if (!is_string($json) || $json === '') {

    return '';

  }

  $encoded = b64url_encode($json);

  $sig = hash_hmac('sha256', $encoded, auth_signing_key());

  return $encoded . '.' . $sig;

}



function user_id_from_auth_token(string $token): ?int {

  $token = trim($token);

  if ($token === '') {

    return null;

  }

  $parts = explode('.', $token, 2);

  if (count($parts) !== 2) {

    return null;

  }

  $encoded = $parts[0];

  $sig = strtolower($parts[1]);

  if ($encoded === '' || $sig === '') {

    return null;

  }



  $expectedSig = hash_hmac('sha256', $encoded, auth_signing_key());

  if (!hash_equals($expectedSig, $sig)) {

    return null;

  }



  $json = b64url_decode($encoded);

  if ($json === null) {

    return null;

  }

  $payload = json_decode($json, true);

  if (!is_array($payload)) {

    return null;

  }



  $uid = (int)($payload['uid'] ?? 0);

  $exp = (int)($payload['exp'] ?? 0);

  if ($uid <= 0 || $exp <= 0 || $exp < time()) {

    return null;

  }

  return $uid;

}



function bearer_token_from_request(): string {

  $auth = trim((string)($_SERVER['HTTP_AUTHORIZATION'] ?? ''));

  if ($auth === '') {

    $auth = trim((string)($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? ''));

  }

  if ($auth === '' && function_exists('getallheaders')) {

    $headers = getallheaders();

    if (is_array($headers)) {

      foreach ($headers as $key => $value) {

        if (strtolower((string)$key) === 'authorization') {

          $auth = trim((string)$value);

          break;

        }

      }

    }

  }

  if ($auth === '') {

    return '';

  }

  if (preg_match('/^Bearer\s+(.+)$/i', $auth, $m)) {

    return trim((string)$m[1]);

  }

  return '';

}



function user_id_from_auth_cookie(): ?int {

  return user_id_from_auth_token(trim((string)($_COOKIE[auth_cookie_name()] ?? '')));

}



function issue_auth_cookie(int $userId): void {

  $token = issue_auth_token($userId);

  if ($token === '') {

    return;

  }

  $payload = json_decode((string)b64url_decode(explode('.', $token, 2)[0]), true);

  $exp = is_array($payload) ? (int)($payload['exp'] ?? 0) : time() + (60 * 60 * 24 * 7);

  $opts = auth_cookie_options();

  $opts['expires'] = $exp > 0 ? $exp : time() + (60 * 60 * 24 * 7);

  setcookie(auth_cookie_name(), $token, $opts);

}



function clear_auth_cookie(): void {

  $opts = auth_cookie_options();

  $opts['expires'] = time() - 3600;

  setcookie(auth_cookie_name(), '', $opts);

}



function start_app_session(): void {

  $cfg = get_config();

  $s = $cfg['session'] ?? [];



  $name = $s['name'] ?? 'turnout_sess';

  $secure = (bool)($s['cookie_secure'] ?? false);

  $httponly = (bool)($s['cookie_httponly'] ?? true);

  $samesite = $s['cookie_samesite'] ?? 'Lax';

  if (!in_array($samesite, ['Lax', 'Strict', 'None'], true)) {

    $samesite = 'Lax';

  }



  session_name($name);

  session_set_cookie_params([

    'lifetime' => 0,

    'path' => '/',

    'secure' => $secure,

    'httponly' => $httponly,

    'samesite' => $samesite,

  ]);



  if (session_status() !== PHP_SESSION_ACTIVE) {

    session_start();

  }

}



/** Serverless-safe: prefer Bearer token or signed cookie over PHP session files. */

function current_user_id(): ?int {

  $bearer = bearer_token_from_request();

  if ($bearer !== '') {

    $uid = user_id_from_auth_token($bearer);

    if ($uid !== null) {

      $_SESSION['user_id'] = $uid;

      return $uid;

    }

  }



  $cookieUid = user_id_from_auth_cookie();

  if ($cookieUid !== null) {

    $_SESSION['user_id'] = $cookieUid;

    return $cookieUid;

  }



  $id = $_SESSION['user_id'] ?? null;

  if ($id === null) {

    return null;

  }

  $n = intval($id);

  return $n > 0 ? $n : null;

}



function require_user_id(): int {

  $uid = current_user_id();

  if ($uid === null) {

    json_response(401, ['error' => 'unauthorized', 'message' => 'Please sign in again.']);

  }

  return $uid;

}



function regenerate_app_session(): void {

  if (session_status() !== PHP_SESSION_ACTIVE) {

    return;

  }

  session_regenerate_id(true);

}



function load_user_profile(int $userId): array {

  $stmt = db()->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');

  $stmt->execute([$userId]);

  $row = $stmt->fetch();

  if (!$row) {

    json_response(401, ['error' => 'unauthorized']);

  }



  return [

    'uid' => (string)$row['id'],

    'email' => $row['email'],

    'displayName' => $row['display_name'],

    'role' => $row['role'],

    'isBlocked' => (int)($row['is_blocked'] ?? 0) === 1,

    'status' => (string)($row['status'] ?? 'active'),

    'forcePasswordReset' => (int)($row['force_password_reset'] ?? 0) === 1,

    'emailVerified' => array_key_exists('email_verified_at', $row) ? user_email_is_verified($row) : true,

    'createdAt' => gmdate('c', strtotime($row['created_at'])),

  ];

}



/**
 * Order access token. Omit attendee args for purchaser (all passes).
 * Pass attendee id(s) to limit the success page to specific ticket holders.
 */
function issue_order_access_token(int $orderId, ?int $attendeeId = null, ?array $attendeeIds = null): string {

  $now = time();

  $payload = ['oid' => $orderId, 'exp' => $now + (60 * 60 * 24 * 14)];

  if ($attendeeId !== null && $attendeeId > 0) {

    $payload['aid'] = $attendeeId;

  } elseif (is_array($attendeeIds) && count($attendeeIds) > 0) {

    $ids = array_values(array_unique(array_filter(array_map('intval', $attendeeIds), static fn($id) => $id > 0)));

    if (count($ids) === 1) {

      $payload['aid'] = $ids[0];

    } elseif (count($ids) > 1) {

      $payload['aids'] = $ids;

    }

  }

  $json = json_encode($payload, JSON_UNESCAPED_SLASHES);

  if (!is_string($json) || $json === '') {

    return '';

  }

  $encoded = b64url_encode($json);

  $sig = hash_hmac('sha256', $encoded, auth_signing_key());

  return $encoded . '.' . $sig;

}



function auth_success_payload(int $userId, array $extra = []): array {
  return array_merge(
    [
      'user' => load_user_profile($userId),
      'authToken' => issue_auth_token($userId),
    ],
    $extra
  );
}

function order_access_token_payload(string $token, int $orderId): ?array {

  $token = trim($token);

  if ($token === '' || $orderId <= 0) {

    return null;

  }

  $parts = explode('.', $token, 2);

  if (count($parts) !== 2) {

    return null;

  }

  $encoded = $parts[0];

  $sig = strtolower($parts[1]);

  $expectedSig = hash_hmac('sha256', $encoded, auth_signing_key());

  if (!hash_equals($expectedSig, $sig)) {

    return null;

  }

  $json = b64url_decode($encoded);

  if ($json === null) {

    return null;

  }

  $payload = json_decode($json, true);

  if (!is_array($payload)) {

    return null;

  }

  $oid = (int)($payload['oid'] ?? 0);

  $exp = (int)($payload['exp'] ?? 0);

  if ($oid !== $orderId || $exp <= time()) {

    return null;

  }

  return $payload;

}



/** @return int[]|null Null = full order; non-null = only these attendee row ids */
function order_access_token_attendee_ids(?array $payload): ?array {

  if ($payload === null) {

    return null;

  }

  if (isset($payload['aid'])) {

    $id = (int)$payload['aid'];

    return $id > 0 ? [$id] : null;

  }

  if (isset($payload['aids']) && is_array($payload['aids'])) {

    $ids = array_values(array_unique(array_filter(array_map('intval', $payload['aids']), static fn($id) => $id > 0)));

    return count($ids) > 0 ? $ids : null;

  }

  return null;

}



function order_access_token_valid(string $token, int $orderId): bool {

  return order_access_token_payload($token, $orderId) !== null;

}



/** Password reset link token (1 hour). */
function issue_password_reset_token(int $userId): string {
  if ($userId <= 0) {
    return '';
  }
  $payload = ['uid' => $userId, 'exp' => time() + 3600, 'pr' => 1];
  $json = json_encode($payload, JSON_UNESCAPED_SLASHES);
  if (!is_string($json) || $json === '') {
    return '';
  }
  $encoded = b64url_encode($json);
  $sig = hash_hmac('sha256', $encoded, auth_signing_key());
  return $encoded . '.' . $sig;
}



function password_reset_token_user_id(string $token): ?int {
  $token = trim($token);
  if ($token === '') {
    return null;
  }
  $parts = explode('.', $token, 2);
  if (count($parts) !== 2) {
    return null;
  }
  $encoded = $parts[0];
  $sig = strtolower($parts[1]);
  $expectedSig = hash_hmac('sha256', $encoded, auth_signing_key());
  if (!hash_equals($expectedSig, $sig)) {
    return null;
  }
  $json = b64url_decode($encoded);
  if ($json === null) {
    return null;
  }
  $payload = json_decode($json, true);
  if (!is_array($payload)) {
    return null;
  }
  if ((int)($payload['pr'] ?? 0) !== 1) {
    return null;
  }
  $uid = (int)($payload['uid'] ?? 0);
  $exp = (int)($payload['exp'] ?? 0);
  if ($uid <= 0 || $exp <= time()) {
    return null;
  }
  return $uid;
}

/** Email verification link token (24 hours). */
function issue_email_verification_token(int $userId, string $email): string {
  if ($userId <= 0) {
    return '';
  }
  $email = strtolower(trim($email));
  if ($email === '') {
    return '';
  }
  $payload = [
    'uid' => $userId,
    'email' => $email,
    'exp' => time() + (60 * 60 * 24),
    'ev' => 1,
  ];
  $json = json_encode($payload, JSON_UNESCAPED_SLASHES);
  if (!is_string($json) || $json === '') {
    return '';
  }
  $encoded = b64url_encode($json);
  $sig = hash_hmac('sha256', $encoded, auth_signing_key());
  return $encoded . '.' . $sig;
}

/**
 * @return array{uid:int,email:string}|null
 */
function email_verification_token_payload(string $token): ?array {
  $token = trim($token);
  if ($token === '') {
    return null;
  }
  $parts = explode('.', $token, 2);
  if (count($parts) !== 2) {
    return null;
  }
  $encoded = $parts[0];
  $sig = strtolower($parts[1]);
  $expectedSig = hash_hmac('sha256', $encoded, auth_signing_key());
  if (!hash_equals($expectedSig, $sig)) {
    return null;
  }
  $json = b64url_decode($encoded);
  if ($json === null) {
    return null;
  }
  $payload = json_decode($json, true);
  if (!is_array($payload)) {
    return null;
  }
  if ((int)($payload['ev'] ?? 0) !== 1) {
    return null;
  }
  $uid = (int)($payload['uid'] ?? 0);
  $email = strtolower(trim((string)($payload['email'] ?? '')));
  $exp = (int)($payload['exp'] ?? 0);
  if ($uid <= 0 || $email === '' || $exp <= time()) {
    return null;
  }
  return ['uid' => $uid, 'email' => $email];
}


