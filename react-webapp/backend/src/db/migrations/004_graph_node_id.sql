-- Add graph_node_id to users if it was missing from the original table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS graph_node_id VARCHAR;
