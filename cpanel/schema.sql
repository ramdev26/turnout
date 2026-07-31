-- Turnout cPanel MySQL schema
-- Import this file in phpMyAdmin.
-- Charset/collation defaults are set to utf8mb4 for emoji-safe text.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS users (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organizer_user_id BIGINT UNSIGNED NOT NULL,
  slug VARCHAR(180) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  event_date DATETIME NOT NULL,
  location VARCHAR(255) NOT NULL,
  banner_url TEXT NOT NULL,
  template_id VARCHAR(64) NOT NULL,
  customization_json JSON NOT NULL,
  custom_domain VARCHAR(255) NULL,
  status ENUM('draft','published','cancelled','blocked') NOT NULL DEFAULT 'published',
  event_status ENUM('pending','approved','rejected','suspended') NOT NULL DEFAULT 'approved',
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_events_slug (slug),
  UNIQUE KEY uniq_events_custom_domain (custom_domain),
  KEY idx_events_organizer (organizer_user_id),
  KEY idx_events_status (status),
  CONSTRAINT fk_events_organizer FOREIGN KEY (organizer_user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tickets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(160) NOT NULL,
  price_cents INT UNSIGNED NOT NULL DEFAULT 0,
  quantity INT UNSIGNED NOT NULL,
  sold INT UNSIGNED NOT NULL DEFAULT 0,
  description TEXT NULL,
  PRIMARY KEY (id),
  KEY idx_tickets_event (event_id),
  CONSTRAINT fk_tickets_event FOREIGN KEY (event_id) REFERENCES events(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id BIGINT UNSIGNED NOT NULL,
  buyer_user_id BIGINT UNSIGNED NULL,
  buyer_name VARCHAR(160) NULL,
  buyer_phone VARCHAR(60) NULL,
  buyer_email VARCHAR(255) NOT NULL,
  tickets_json JSON NOT NULL,
  total_amount_cents INT UNSIGNED NOT NULL,
  status ENUM('pending','paid','failed') NOT NULL DEFAULT 'paid',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_orders_event (event_id),
  KEY idx_orders_buyer (buyer_user_id),
  CONSTRAINT fk_orders_event FOREIGN KEY (event_id) REFERENCES events(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_orders_buyer FOREIGN KEY (buyer_user_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attendees (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  event_id BIGINT UNSIGNED NOT NULL,
  ticket_id BIGINT UNSIGNED NOT NULL,
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(60) NULL,
  custom_fields_json JSON NULL,
  qr_token CHAR(32) NOT NULL,
  checked_in_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_attendees_qr (qr_token),
  KEY idx_attendees_order (order_id),
  KEY idx_attendees_event (event_id),
  CONSTRAINT fk_attendees_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_attendees_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT fk_attendees_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS speakers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(160) NOT NULL,
  title VARCHAR(160) NULL,
  company VARCHAR(160) NULL,
  bio TEXT NULL,
  avatar_url TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_speakers_event (event_id),
  CONSTRAINT fk_speakers_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  location VARCHAR(255) NULL,
  speaker_ids_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sessions_event (event_id),
  KEY idx_sessions_starts (starts_at),
  CONSTRAINT fk_sessions_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id BIGINT UNSIGNED NOT NULL,
  avatar_url TEXT NULL,
  phone VARCHAR(60) NULL,
  bio TEXT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_user_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS event_runbook_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  priority ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  status ENUM('open','done') NOT NULL DEFAULT 'open',
  due_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_runbook_event_created (event_id, created_at),
  CONSTRAINT fk_runbook_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_attendee_requests (
  order_id BIGINT UNSIGNED NOT NULL,
  attendees_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id),
  CONSTRAINT fk_oar_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payhere_transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  payment_id VARCHAR(64) NULL,
  status_code VARCHAR(16) NOT NULL,
  payhere_amount VARCHAR(32) NULL,
  payhere_currency VARCHAR(16) NULL,
  method VARCHAR(32) NULL,
  status_message TEXT NULL,
  raw_post_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payhere_tx_order (order_id, created_at),
  CONSTRAINT fk_payhere_tx_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_settings (
  setting_key VARCHAR(120) NOT NULL,
  setting_value VARCHAR(255) NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS global_settings (
  setting_key VARCHAR(120) NOT NULL,
  setting_value TEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  order_id BIGINT UNSIGNED NULL,
  amount_cents INT UNSIGNED NOT NULL,
  platform_fee_cents INT UNSIGNED NOT NULL,
  organizer_amount_cents INT UNSIGNED NOT NULL,
  payment_status ENUM('pending','paid','failed') NOT NULL DEFAULT 'pending',
  payhere_reference VARCHAR(128) NULL,
  is_flagged TINYINT(1) NOT NULL DEFAULT 0,
  admin_note TEXT NULL,
  refund_requested TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tx_event (event_id),
  KEY idx_tx_user (user_id),
  KEY idx_tx_status_created (payment_status, created_at),
  KEY idx_tx_order (order_id),
  CONSTRAINT fk_tx_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT fk_tx_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_tx_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payouts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organizer_id BIGINT UNSIGNED NOT NULL,
  total_amount_cents INT UNSIGNED NOT NULL,
  status ENUM('pending','processing','completed') NOT NULL DEFAULT 'pending',
  method ENUM('bank_transfer') NOT NULL DEFAULT 'bank_transfer',
  reference VARCHAR(128) NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_payout_org (organizer_id, created_at),
  KEY idx_payout_status (status, created_at),
  CONSTRAINT fk_payout_org FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payout_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  payout_id BIGINT UNSIGNED NOT NULL,
  admin_user_id BIGINT UNSIGNED NULL,
  action VARCHAR(64) NOT NULL,
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payout_logs_payout (payout_id, created_at),
  CONSTRAINT fk_payout_logs_payout FOREIGN KEY (payout_id) REFERENCES payouts(id) ON DELETE CASCADE,
  CONSTRAINT fk_payout_logs_admin FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_user_id BIGINT UNSIGNED NULL,
  actor_role VARCHAR(40) NULL,
  action VARCHAR(120) NOT NULL,
  target_type VARCHAR(80) NULL,
  target_id VARCHAR(80) NULL,
  details_json JSON NULL,
  ip_address VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_logs_action_created (action, created_at),
  KEY idx_logs_actor_created (actor_user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organizer_profiles (
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
  bank_account_type VARCHAR(64) NULL,
  bank_address TEXT NULL,
  bank_code VARCHAR(32) NULL,
  bank_branch_code VARCHAR(32) NULL,
  bank_swift_code VARCHAR(32) NULL,
  business_registration_doc_url TEXT NULL,
  bank_statement_doc_url TEXT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_org_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organizer_payment_settings (
  user_id BIGINT UNSIGNED NOT NULL,
  gateway_mode ENUM('turnout','own_payhere') NOT NULL DEFAULT 'turnout',
  payhere_merchant_id VARCHAR(64) NULL,
  payhere_merchant_secret_enc TEXT NULL,
  billing_customer_token TEXT NULL,
  billing_card_last4 VARCHAR(8) NULL,
  billing_card_brand VARCHAR(32) NULL,
  billing_setup_status ENUM('none','pending','active','failed') NOT NULL DEFAULT 'none',
  billing_setup_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_org_payment_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organizer_billing_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  setup_order_id VARCHAR(64) NOT NULL,
  status ENUM('pending','completed','failed') NOT NULL DEFAULT 'pending',
  raw_notify_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_billing_setup_order (setup_order_id),
  KEY idx_billing_sessions_user (user_id, created_at),
  CONSTRAINT fk_billing_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organizer_team_members (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organizer_invites (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS event_page_visits (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id BIGINT UNSIGNED NOT NULL,
  visitor_key VARCHAR(64) NOT NULL,
  source VARCHAR(120) NOT NULL DEFAULT 'Direct',
  referrer TEXT NULL,
  referrer_host VARCHAR(255) NULL,
  utm_source VARCHAR(120) NULL,
  utm_medium VARCHAR(120) NULL,
  utm_campaign VARCHAR(160) NULL,
  path VARCHAR(255) NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_epv_event_created (event_id, created_at),
  KEY idx_epv_event_visitor (event_id, visitor_key),
  KEY idx_epv_event_source (event_id, source),
  CONSTRAINT fk_epv_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
