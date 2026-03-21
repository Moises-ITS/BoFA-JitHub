import dotenv from "dotenv"
import { fileURLToPath } from "url"
import path from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, "../../.env") })

import { db } from "../config/postgres.js"

// SQL is inlined so the runner works in both src/ and dist/ builds.
const MIGRATIONS: Array<{ name: string; sql: string }> = [
  {
    name: "001_create_users",
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id              VARCHAR PRIMARY KEY,
        email           VARCHAR UNIQUE NOT NULL,
        name            VARCHAR,
        password_hash   VARCHAR,
        major           VARCHAR,
        gpa             DECIMAL(3,2),
        graduation_year INTEGER,
        bio             TEXT,
        clubs           TEXT[] DEFAULT '{}',
        companies       TEXT[] DEFAULT '{}',
        interests       TEXT[] DEFAULT '{}',
        graph_node_id   VARCHAR,
        linkedin_url    VARCHAR,
        skills          TEXT[] DEFAULT '{}',
        looking_for     TEXT[] DEFAULT '{}',
        year            VARCHAR(20),
        clerk_id        VARCHAR UNIQUE,
        created_at      TIMESTAMP DEFAULT NOW()
      );
    `,
  },
  {
    name: "002_auth_columns",
    sql: `
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS password_hash   VARCHAR,
        ADD COLUMN IF NOT EXISTS major           VARCHAR,
        ADD COLUMN IF NOT EXISTS gpa             DECIMAL(3,2),
        ADD COLUMN IF NOT EXISTS graduation_year INTEGER,
        ADD COLUMN IF NOT EXISTS bio             TEXT,
        ADD COLUMN IF NOT EXISTS clubs           TEXT[] DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS companies       TEXT[] DEFAULT '{}';
    `,
  },
  {
    name: "003_connection_requests",
    sql: `
      CREATE TABLE IF NOT EXISTS connection_requests (
        id           SERIAL PRIMARY KEY,
        from_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        to_user_id   VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status       VARCHAR NOT NULL DEFAULT 'pending',
        created_at   TIMESTAMP DEFAULT NOW(),
        updated_at   TIMESTAMP DEFAULT NOW(),
        UNIQUE(from_user_id, to_user_id)
      );
    `,
  },
  {
    name: "004_interests",
    sql: `
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS interests TEXT[] DEFAULT '{}';
    `,
  },
  {
    name: "005_graph_node_id",
    sql: `
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS graph_node_id VARCHAR;
    `,
  },
  {
    name: "006_linkedin",
    sql: `
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR;
    `,
  },
  {
    name: "007_skills_looking_for_year",
    sql: `
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS looking_for TEXT[] DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS year VARCHAR(20);
    `,
  },
  {
    name: "008_clerk_id",
    sql: `
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS clerk_id VARCHAR;
      CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);
    `,
  },
  {
    name: "009_user_chat_memory",
    sql: `
      CREATE TABLE IF NOT EXISTS user_chat_memory (
        user_id   TEXT NOT NULL,
        topic     TEXT NOT NULL,
        weight    INT NOT NULL DEFAULT 1,
        last_seen TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, topic)
      );
    `,
  },
]

export async function runMigrations() {
  for (const { name, sql } of MIGRATIONS) {
    try {
      await db.query(sql)
      console.log(`Migration ${name} applied`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn(`Migration ${name} warning: ${message}`)
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url).endsWith(path.basename(process.argv[1]))) {
  runMigrations().finally(() => db.end())
}
