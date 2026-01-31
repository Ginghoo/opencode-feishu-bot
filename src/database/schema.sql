CREATE TABLE IF NOT EXISTS user_sessions (
  chat_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  project_path TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_whitelist (
  user_id TEXT PRIMARY KEY,
  added_by TEXT NOT NULL,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_mappings (
  chat_id TEXT PRIMARY KEY,
  project_path TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_dedup (
  event_id TEXT PRIMARY KEY,
  processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS message_mappings (
  user_message_id TEXT PRIMARY KEY,
  bot_message_id TEXT,
  chat_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 会话群：每个群对应一个独立的 OpenCode 会话
CREATE TABLE IF NOT EXISTS session_chats (
  chat_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  project_path TEXT NOT NULL,
  title TEXT,
  title_set BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_event_dedup_processed_at ON event_dedup(processed_at);
CREATE INDEX IF NOT EXISTS idx_message_mappings_chat_id ON message_mappings(chat_id);
CREATE INDEX IF NOT EXISTS idx_message_mappings_created_at ON message_mappings(created_at);
CREATE INDEX IF NOT EXISTS idx_session_chats_owner_id ON session_chats(owner_id);
CREATE INDEX IF NOT EXISTS idx_session_chats_session_id ON session_chats(session_id);
