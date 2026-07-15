<?php

/**
 * Ensure core app tables exist (users/events/orders/...).
 * Fresh managed Postgres (Prisma/Neon/Aurora) starts empty — without this,
 * login fails because `users` is missing.
 */
function ensure_core_schema(PDO $pdo): void {
  static $checked = false;
  if ($checked) return;

  $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  try {
    if ($driver === 'pgsql') {
      ensure_core_schema_pgsql($pdo);
    } elseif ($driver === 'sqlite') {
      // SQLite is created from schema.sqlite.sql on first connect in db().
    } else {
      ensure_core_schema_mysql($pdo);
    }
  } catch (Throwable $e) {
    error_log(sprintf('[turnout] ensure_core_schema: %s', $e->getMessage()));
  }
  $checked = true;
}

function ensure_core_schema_pgsql(PDO $pdo): void {
  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(120) NOT NULL,
      role VARCHAR(32) NOT NULL DEFAULT 'organizer',
      is_blocked SMALLINT NOT NULL DEFAULT 0,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      force_password_reset SMALLINT NOT NULL DEFAULT 0,
      email_verified_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )"
  );

  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS events (
      id BIGSERIAL PRIMARY KEY,
      organizer_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      slug VARCHAR(180) NOT NULL UNIQUE,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      event_date TIMESTAMP NOT NULL,
      location VARCHAR(255) NOT NULL,
      banner_url TEXT NOT NULL,
      template_id VARCHAR(64) NOT NULL,
      customization_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      custom_domain VARCHAR(255) NULL UNIQUE,
      status VARCHAR(32) NOT NULL DEFAULT 'published',
      event_status VARCHAR(32) NOT NULL DEFAULT 'approved',
      is_featured SMALLINT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )"
  );
  $pdo->exec('CREATE INDEX IF NOT EXISTS idx_events_organizer ON events(organizer_user_id)');
  $pdo->exec('CREATE INDEX IF NOT EXISTS idx_events_status ON events(status)');

  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS tickets (
      id BIGSERIAL PRIMARY KEY,
      event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      name VARCHAR(160) NOT NULL,
      price_cents INTEGER NOT NULL DEFAULT 0,
      quantity INTEGER NOT NULL,
      sold INTEGER NOT NULL DEFAULT 0,
      description TEXT NULL
    )"
  );
  $pdo->exec('CREATE INDEX IF NOT EXISTS idx_tickets_event ON tickets(event_id)');

  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS orders (
      id BIGSERIAL PRIMARY KEY,
      event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      buyer_user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
      buyer_name VARCHAR(160) NULL,
      buyer_phone VARCHAR(60) NULL,
      buyer_email VARCHAR(255) NOT NULL,
      tickets_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      total_amount_cents INTEGER NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'paid',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )"
  );
  $pdo->exec('CREATE INDEX IF NOT EXISTS idx_orders_event ON orders(event_id)');
  $pdo->exec('CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_user_id)');

  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS attendees (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE RESTRICT,
      full_name VARCHAR(160) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(60) NULL,
      custom_fields_json JSONB NULL,
      qr_token CHAR(32) NOT NULL UNIQUE,
      checked_in_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )"
  );
  $pdo->exec('CREATE INDEX IF NOT EXISTS idx_attendees_order ON attendees(order_id)');
  $pdo->exec('CREATE INDEX IF NOT EXISTS idx_attendees_event ON attendees(event_id)');

  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS speakers (
      id BIGSERIAL PRIMARY KEY,
      event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      name VARCHAR(160) NOT NULL,
      title VARCHAR(160) NULL,
      company VARCHAR(160) NULL,
      bio TEXT NULL,
      avatar_url TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )"
  );

  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS sessions (
      id BIGSERIAL PRIMARY KEY,
      event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      starts_at TIMESTAMP NOT NULL,
      ends_at TIMESTAMP NOT NULL,
      location VARCHAR(255) NULL,
      speaker_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )"
  );

  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS user_profiles (
      user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      avatar_url TEXT NULL,
      phone VARCHAR(60) NULL,
      bio TEXT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )"
  );

  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS event_runbook_items (
      id BIGSERIAL PRIMARY KEY,
      event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      priority VARCHAR(16) NOT NULL DEFAULT 'medium',
      status VARCHAR(16) NOT NULL DEFAULT 'open',
      due_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )"
  );

  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS order_attendee_requests (
      order_id BIGINT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
      attendees_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )"
  );

  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS payhere_transactions (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      payment_id VARCHAR(128) NULL,
      status_code VARCHAR(32) NOT NULL,
      payhere_amount VARCHAR(32) NULL,
      payhere_currency VARCHAR(16) NULL,
      method VARCHAR(64) NULL,
      status_message TEXT NULL,
      raw_post_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )"
  );
  $pdo->exec('CREATE INDEX IF NOT EXISTS idx_payhere_tx_order ON payhere_transactions(order_id, created_at DESC)');
}

function ensure_core_schema_mysql(PDO $pdo): void {
  // Best-effort for fresh MySQL; ignore if tables already exist with different defs.
  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      email VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(120) NOT NULL,
      role ENUM('organizer','attendee','super_admin') NOT NULL DEFAULT 'organizer',
      is_blocked TINYINT(1) NOT NULL DEFAULT 0,
      status ENUM('active','suspended','banned') NOT NULL DEFAULT 'active',
      force_password_reset TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_users_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
}
