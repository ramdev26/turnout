<?php

const ORGANIZER_TEAM_ROLES = ['admin', 'editor', 'viewer'];

function organizer_role_rank(string $role): int {
  return match ($role) {
    'owner' => 4,
    'admin' => 3,
    'editor' => 2,
    'viewer' => 1,
    default => 0,
  };
}

function normalize_organizer_team_role(string $role): string {
  $role = strtolower(trim($role));
  return in_array($role, ORGANIZER_TEAM_ROLES, true) ? $role : 'editor';
}

function ensure_organizer_workspace_tables(PDO $pdo): void {
  static $checked = false;
  if ($checked) return;
  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);

  if ($driver === 'sqlite') {
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS organizer_profiles (
        user_id INTEGER PRIMARY KEY,
        organization_name TEXT NOT NULL DEFAULT "",
        logo_url TEXT NULL,
        website TEXT NULL,
        phone TEXT NULL,
        business_address TEXT NULL,
        business_registration_no TEXT NULL,
        bank_account_holder_name TEXT NULL,
        bank_name TEXT NULL,
        bank_branch TEXT NULL,
        bank_account_number TEXT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )'
    );
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS organizer_team_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_user_id INTEGER NOT NULL,
        member_user_id INTEGER NOT NULL,
        role TEXT NOT NULL DEFAULT "editor",
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(owner_user_id, member_user_id)
      )'
    );
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS organizer_invites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_user_id INTEGER NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT "editor",
        token CHAR(32) NOT NULL UNIQUE,
        invited_by_user_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT "pending",
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )'
    );
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_team_member ON organizer_team_members(member_user_id)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_invites_owner ON organizer_invites(owner_user_id, status)');
    $checked = true;
    return;
  }

  if ($driver === 'pgsql') {
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS organizer_profiles (
        user_id BIGINT PRIMARY KEY,
        organization_name VARCHAR(255) NOT NULL DEFAULT \'\',
        logo_url TEXT NULL,
        website VARCHAR(255) NULL,
        phone VARCHAR(60) NULL,
        business_address TEXT NULL,
        business_registration_no VARCHAR(128) NULL,
        bank_account_holder_name VARCHAR(255) NULL,
        bank_name VARCHAR(255) NULL,
        bank_branch VARCHAR(255) NULL,
        bank_account_number VARCHAR(64) NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )'
    );
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS organizer_team_members (
        id BIGSERIAL PRIMARY KEY,
        owner_user_id BIGINT NOT NULL,
        member_user_id BIGINT NOT NULL,
        role VARCHAR(16) NOT NULL DEFAULT \'editor\',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(owner_user_id, member_user_id)
      )'
    );
    $pdo->exec(
      'CREATE TABLE IF NOT EXISTS organizer_invites (
        id BIGSERIAL PRIMARY KEY,
        owner_user_id BIGINT NOT NULL,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(16) NOT NULL DEFAULT \'editor\',
        token CHAR(32) NOT NULL UNIQUE,
        invited_by_user_id BIGINT NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT \'pending\',
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )'
    );
    $checked = true;
    return;
  }

  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS organizer_profiles (
      user_id BIGINT UNSIGNED NOT NULL,
      organization_name VARCHAR(255) NOT NULL DEFAULT '',
      logo_url TEXT NULL,
      website VARCHAR(255) NULL,
      phone VARCHAR(60) NULL,
      business_address TEXT NULL,
      business_registration_no VARCHAR(128) NULL,
      bank_account_holder_name VARCHAR(255) NULL,
      bank_name VARCHAR(255) NULL,
      bank_branch VARCHAR(255) NULL,
      bank_account_number VARCHAR(64) NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id),
      CONSTRAINT fk_org_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS organizer_team_members (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      owner_user_id BIGINT UNSIGNED NOT NULL,
      member_user_id BIGINT UNSIGNED NOT NULL,
      role ENUM('admin','editor','viewer') NOT NULL DEFAULT 'editor',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_team_owner_member (owner_user_id, member_user_id),
      KEY idx_team_member (member_user_id),
      CONSTRAINT fk_team_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_team_member FOREIGN KEY (member_user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS organizer_invites (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      owner_user_id BIGINT UNSIGNED NOT NULL,
      email VARCHAR(255) NOT NULL,
      role ENUM('admin','editor','viewer') NOT NULL DEFAULT 'editor',
      token CHAR(32) NOT NULL,
      invited_by_user_id BIGINT UNSIGNED NOT NULL,
      status ENUM('pending','accepted','revoked') NOT NULL DEFAULT 'pending',
      expires_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_invite_token (token),
      KEY idx_invites_owner (owner_user_id, status),
      CONSTRAINT fk_invite_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
  $checked = true;
}

/** @return list<int> */
function organizer_accessible_owner_ids(PDO $pdo, int $uid): array {
  ensure_organizer_workspace_tables($pdo);
  $ids = [$uid];
  $stmt = $pdo->prepare('SELECT DISTINCT owner_user_id FROM organizer_team_members WHERE member_user_id = ?');
  $stmt->execute([$uid]);
  while ($row = $stmt->fetch()) {
    $oid = (int)($row['owner_user_id'] ?? 0);
    if ($oid > 0) $ids[] = $oid;
  }
  return array_values(array_unique($ids));
}

function organizer_team_role_for_owner(PDO $pdo, int $uid, int $ownerUserId): ?string {
  if ($uid === $ownerUserId) return 'owner';
  ensure_organizer_workspace_tables($pdo);
  $stmt = $pdo->prepare(
    'SELECT role FROM organizer_team_members WHERE owner_user_id = ? AND member_user_id = ? LIMIT 1'
  );
  $stmt->execute([$ownerUserId, $uid]);
  $row = $stmt->fetch();
  if (!$row) return null;
  return normalize_organizer_team_role((string)($row['role'] ?? 'editor'));
}

function user_can_access_event_row(PDO $pdo, array $eventRow, int $uid, string $minRole = 'viewer'): bool {
  $ownerId = (int)($eventRow['organizer_user_id'] ?? 0);
  if ($ownerId <= 0) return false;
  $role = organizer_team_role_for_owner($pdo, $uid, $ownerId);
  if ($role === null) return false;
  return organizer_role_rank($role) >= organizer_role_rank($minRole);
}

function user_can_access_event(PDO $pdo, int $eventId, int $uid, string $minRole = 'viewer'): bool {
  $stmt = $pdo->prepare('SELECT organizer_user_id FROM events WHERE id = ? LIMIT 1');
  $stmt->execute([$eventId]);
  $row = $stmt->fetch();
  if (!$row) return false;
  return user_can_access_event_row($pdo, $row, $uid, $minRole);
}

function deny_unless_event_row_access(PDO $pdo, array $eventRow, int $uid, string $minRole = 'editor'): void {
  if (!user_can_access_event_row($pdo, $eventRow, $uid, $minRole)) {
    json_response(403, ['error' => 'forbidden']);
  }
}

function require_workspace_owner(PDO $pdo, int $uid): int {
  require_organizer_user_id();
  return $uid;
}

function resolve_event_owner_for_create(PDO $pdo, int $uid): int {
  ensure_organizer_workspace_tables($pdo);
  $stmt = $pdo->prepare(
    "SELECT owner_user_id FROM organizer_team_members
     WHERE member_user_id = ? AND role IN ('admin', 'editor')
     ORDER BY created_at ASC LIMIT 1"
  );
  $stmt->execute([$uid]);
  $row = $stmt->fetch();
  if ($row) return (int)$row['owner_user_id'];
  return $uid;
}

function load_organizer_profile_row(PDO $pdo, int $ownerUserId): array {
  ensure_organizer_workspace_tables($pdo);
  $stmt = $pdo->prepare('SELECT * FROM organizer_profiles WHERE user_id = ? LIMIT 1');
  $stmt->execute([$ownerUserId]);
  $row = $stmt->fetch();
  if (!$row) {
    $user = load_user_profile($ownerUserId);
    return [
      'user_id' => $ownerUserId,
      'organization_name' => (string)($user['displayName'] ?? ''),
      'logo_url' => null,
      'website' => null,
      'phone' => null,
      'business_address' => null,
      'business_registration_no' => null,
      'bank_account_holder_name' => null,
      'bank_name' => null,
      'bank_branch' => null,
      'bank_account_number' => null,
    ];
  }
  return $row;
}

function organizer_profile_api_shape(PDO $pdo, int $ownerUserId): array {
  $user = load_user_profile($ownerUserId);
  ensure_organizer_profile_paid_event_columns($pdo);
  $row = load_organizer_profile_row($pdo, $ownerUserId);
  return [
    'ownerUserId' => (string)$ownerUserId,
    'displayName' => (string)($user['displayName'] ?? ''),
    'email' => (string)($user['email'] ?? ''),
    'organizationName' => (string)($row['organization_name'] ?? ''),
    'logoUrl' => $row['logo_url'] ?? null,
    'website' => $row['website'] ?? null,
    'phone' => $row['phone'] ?? null,
    'businessAddress' => trim((string)($row['business_address'] ?? '')) ?: null,
    'businessRegistrationNo' => trim((string)($row['business_registration_no'] ?? '')) ?: null,
    'bankAccountHolderName' => trim((string)($row['bank_account_holder_name'] ?? '')) ?: null,
    'bankName' => trim((string)($row['bank_name'] ?? '')) ?: null,
    'bankBranch' => trim((string)($row['bank_branch'] ?? '')) ?: null,
    'bankAccountNumberLast4' => trim((string)($row['bank_account_number'] ?? '')) !== ''
      ? substr(trim((string)$row['bank_account_number']), -4)
      : null,
    'bankAccountConfigured' => trim((string)($row['bank_account_number'] ?? '')) !== '',
  ];
}

function organizer_workspace_context(PDO $pdo, int $uid): array {
  return [
    'ownerUserId' => (string)$uid,
    'role' => 'owner',
    'isOwner' => true,
    'canManageTeam' => true,
    'canEditEvents' => true,
  ];
}
