-- Add interests column to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS interests TEXT[] DEFAULT '{}';
