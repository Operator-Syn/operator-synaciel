CREATE TABLE IF NOT EXISTS rolling_token_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sub TEXT NOT NULL REFERENCES users(sub) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  estimated_tokens INTEGER NOT NULL CHECK (estimated_tokens > 0)
);

CREATE INDEX IF NOT EXISTS rolling_token_usage_sub_created_idx
  ON rolling_token_usage(sub, created_at);
