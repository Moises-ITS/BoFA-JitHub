CREATE TABLE IF NOT EXISTS user_chat_memory (
  user_id   TEXT NOT NULL,
  topic     TEXT NOT NULL,
  weight    INT  NOT NULL DEFAULT 1,
  last_seen TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, topic)
);
