-- Turnout local dev SQLite schema
-- Used only when api/config.php sets db.driver = 'sqlite'

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'organizer',
  is_blocked INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  force_password_reset INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organizer_user_id INTEGER NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  event_date TEXT NOT NULL,
  location TEXT NOT NULL,
  banner_url TEXT NOT NULL,
  template_id TEXT NOT NULL,
  customization_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  event_status TEXT NOT NULL DEFAULT 'approved',
  is_featured INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organizer_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL,
  sold INTEGER NOT NULL DEFAULT 0,
  description TEXT NULL,
  early_bird_price_cents INTEGER NULL,
  early_bird_end_at TEXT NULL,
  early_bird_limit INTEGER NULL,
  early_bird_sold INTEGER NOT NULL DEFAULT 0,
  bulk_offers_json TEXT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  buyer_user_id INTEGER NULL,
  buyer_name TEXT NULL,
  buyer_phone TEXT NULL,
  buyer_email TEXT NOT NULL,
  tickets_json TEXT NOT NULL,
  total_amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (buyer_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS attendees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  event_id INTEGER NOT NULL,
  ticket_id INTEGER NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NULL,
  custom_fields_json TEXT NULL,
  qr_token TEXT NOT NULL UNIQUE,
  checked_in_at TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS speakers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  title TEXT NULL,
  company TEXT NULL,
  bio TEXT NULL,
  avatar_url TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  location TEXT NULL,
  speaker_ids_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id INTEGER PRIMARY KEY,
  avatar_url TEXT NULL,
  phone TEXT NULL,
  bio TEXT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS event_runbook_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  due_at TEXT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_attendee_requests (
  order_id INTEGER PRIMARY KEY,
  attendees_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payhere_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  payment_id TEXT NULL,
  status_code TEXT NOT NULL,
  payhere_amount TEXT NULL,
  payhere_currency TEXT NULL,
  method TEXT NULL,
  status_message TEXT NULL,
  raw_post_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS global_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  user_id INTEGER NULL,
  order_id INTEGER NULL,
  amount_cents INTEGER NOT NULL,
  platform_fee_cents INTEGER NOT NULL,
  organizer_amount_cents INTEGER NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  payhere_reference TEXT NULL,
  is_flagged INTEGER NOT NULL DEFAULT 0,
  admin_note TEXT NULL,
  refund_requested INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS payouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organizer_id INTEGER NOT NULL,
  total_amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  method TEXT NOT NULL DEFAULT 'bank_transfer',
  reference TEXT NULL,
  notes TEXT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT NULL,
  FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payout_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payout_id INTEGER NOT NULL,
  admin_user_id INTEGER NULL,
  action TEXT NOT NULL,
  note TEXT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payout_id) REFERENCES payouts(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER NULL,
  actor_role TEXT NULL,
  action TEXT NOT NULL,
  target_type TEXT NULL,
  target_id TEXT NULL,
  details_json TEXT NULL,
  ip_address TEXT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_runbook_event_created ON event_runbook_items(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payhere_tx_order ON payhere_transactions(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_status_created ON transactions(payment_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payout_org ON payouts(organizer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payout_logs_payout ON payout_logs(payout_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_action_created ON logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_actor_created ON logs(actor_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS organizer_profiles (
  user_id INTEGER PRIMARY KEY,
  organization_name TEXT NOT NULL DEFAULT '',
  logo_url TEXT NULL,
  website TEXT NULL,
  phone TEXT NULL,
  business_address TEXT NULL,
  business_registration_no TEXT NULL,
  bank_account_holder_name TEXT NULL,
  bank_name TEXT NULL,
  bank_branch TEXT NULL,
  bank_account_number TEXT NULL,
  bank_account_type TEXT NULL,
  bank_address TEXT NULL,
  bank_code TEXT NULL,
  bank_branch_code TEXT NULL,
  bank_swift_code TEXT NULL,
  business_registration_doc_url TEXT NULL,
  bank_statement_doc_url TEXT NULL,
  turnout_pay_docs_override INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS organizer_payment_settings (
  user_id INTEGER PRIMARY KEY,
  gateway_mode TEXT NOT NULL DEFAULT 'turnout',
  payhere_merchant_id TEXT NULL,
  payhere_merchant_secret_enc TEXT NULL,
  billing_customer_token TEXT NULL,
  billing_card_last4 TEXT NULL,
  billing_card_brand TEXT NULL,
  billing_setup_status TEXT NOT NULL DEFAULT 'none',
  billing_setup_at TEXT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS organizer_billing_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  setup_order_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  raw_notify_json TEXT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_billing_sessions_user ON organizer_billing_sessions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS organizer_team_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_user_id INTEGER NOT NULL,
  member_user_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_user_id, member_user_id),
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (member_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS organizer_invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_user_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor',
  token TEXT NOT NULL UNIQUE,
  invited_by_user_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_team_member ON organizer_team_members(member_user_id);
CREATE INDEX IF NOT EXISTS idx_invites_owner ON organizer_invites(owner_user_id, status);

