-- Full users table — safe to run on any database state
CREATE TABLE IF NOT EXISTS users (
  id              VARCHAR PRIMARY KEY,
  email           VARCHAR UNIQUE NOT NULL,
  name            VARCHAR,
  password_hash   VARCHAR,
  major           VARCHAR,
  gpa             DECIMAL(3,2),
  graduation_year INTEGER,
  bio             TEXT,
  clubs           TEXT[]    DEFAULT '{}',
  companies       TEXT[]    DEFAULT '{}',
  interests       TEXT[]    DEFAULT '{}',
  graph_node_id   VARCHAR,
  created_at      TIMESTAMP DEFAULT NOW()
);
