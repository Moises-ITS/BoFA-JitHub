-- Add auth + profile fields to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash   VARCHAR,
  ADD COLUMN IF NOT EXISTS major           VARCHAR,
  ADD COLUMN IF NOT EXISTS gpa             DECIMAL(3,2),
  ADD COLUMN IF NOT EXISTS graduation_year INTEGER,
  ADD COLUMN IF NOT EXISTS bio             TEXT,
  ADD COLUMN IF NOT EXISTS clubs           TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS companies       TEXT[] DEFAULT '{}';

-- Two-way connection request system
CREATE TABLE IF NOT EXISTS connection_requests (
  id           SERIAL PRIMARY KEY,
  from_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id   VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       VARCHAR NOT NULL DEFAULT 'pending', -- pending | accepted | rejected
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW(),
  UNIQUE(from_user_id, to_user_id)
);
