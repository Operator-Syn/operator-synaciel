CREATE TABLE IF NOT EXISTS users (
  sub TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  quota_epoch INTEGER NOT NULL DEFAULT 0,
  disabled_at INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  id_hash TEXT PRIMARY KEY NOT NULL,
  sub TEXT NOT NULL REFERENCES users(sub) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  revoked_at INTEGER,
  turnstile_verified_at INTEGER
);

CREATE TABLE IF NOT EXISTS oauth_states (
  state_hash TEXT PRIMARY KEY NOT NULL,
  code_verifier TEXT NOT NULL,
  nonce TEXT NOT NULL,
  return_to TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY NOT NULL,
  sub TEXT NOT NULL REFERENCES users(sub) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  title TEXT,
  deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS agent_tokens (
  jti_hash TEXT PRIMARY KEY NOT NULL,
  sub TEXT NOT NULL REFERENCES users(sub) ON DELETE CASCADE,
  session_id_hash TEXT NOT NULL REFERENCES sessions(id_hash) ON DELETE CASCADE,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  quota_epoch INTEGER NOT NULL,
  issued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER
);

CREATE TABLE IF NOT EXISTS usage_windows (
  sub TEXT NOT NULL REFERENCES users(sub) ON DELETE CASCADE,
  utc_day TEXT NOT NULL,
  turns INTEGER NOT NULL DEFAULT 0,
  estimated_neurons INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (sub, utc_day)
);

CREATE TABLE IF NOT EXISTS agent_control (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  paused INTEGER NOT NULL DEFAULT 0,
  pause_reason TEXT,
  estimated_neurons INTEGER NOT NULL DEFAULT 0,
  utc_day TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_sub_idx ON sessions(sub);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS threads_sub_idx ON threads(sub, updated_at);
CREATE INDEX IF NOT EXISTS agent_tokens_expiry_idx ON agent_tokens(expires_at);
CREATE INDEX IF NOT EXISTS agent_tokens_thread_idx ON agent_tokens(thread_id);

INSERT OR IGNORE INTO agent_control (id, paused, pause_reason, estimated_neurons, utc_day, updated_at)
VALUES (1, 0, NULL, 0, strftime('%Y-%m-%d', 'now'), unixepoch() * 1000);
