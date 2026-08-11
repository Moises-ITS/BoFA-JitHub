import dotenv from "dotenv"
import { fileURLToPath } from "url"
import path from "path"
import fs from "fs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const envCandidates = [
  path.resolve(__dirname, "../../.env.local"),
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../../../.env.local"),
  path.resolve(__dirname, "../../../.env"),
]
for (const candidate of envCandidates) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate, override: false })
  }
}

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
  {
    name: "006_password_reset",
    sql: `
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id          SERIAL PRIMARY KEY,
        user_id     VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        code        VARCHAR(6) NOT NULL,
        expires_at  TIMESTAMP NOT NULL,
        used        BOOLEAN DEFAULT FALSE,
        created_at  TIMESTAMP DEFAULT NOW()
      );
    `,
  },
  {
    name: "007_clerk_id",
    sql: `
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS clerk_id VARCHAR UNIQUE;
      CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);
    `,
  },
  {
    name: "010_user_notifications",
    sql: `
      CREATE TABLE IF NOT EXISTS user_notifications (
        id              SERIAL PRIMARY KEY,
        user_id         VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind            VARCHAR NOT NULL,
        title           VARCHAR NOT NULL,
        message         TEXT NOT NULL,
        related_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        is_read         BOOLEAN NOT NULL DEFAULT FALSE,
        created_at      TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created
        ON user_notifications(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_user_notifications_unread
        ON user_notifications(user_id, is_read);
    `,
  },
  {
    // "Incoming requests to me" queries filter by to_user_id alone. The
    // existing UNIQUE(from_user_id, to_user_id) composite only serves as an
    // index prefix for from_user_id — to_user_id lookups were seq-scanning,
    // which gets linearly worse as connection volume grows.
    name: "011_connection_requests_to_user_idx",
    sql: `
      CREATE INDEX IF NOT EXISTS idx_connection_requests_to_user
        ON connection_requests(to_user_id);
    `,
  },
  {
    // The /api/eden attendance routes have always written to this table with
    // ON CONFLICT (event_id), but NO migration ever created it — it only
    // existed because someone created it by hand in the original database.
    // A fresh environment (or the ENABLE_EDEN revival) would crash without
    // this. Columns mirror exactly what routes/eden.ts reads and writes.
    name: "012_event_attendance",
    sql: `
      CREATE TABLE IF NOT EXISTS event_attendance (
        event_id    INT PRIMARY KEY,
        club_id     INT NOT NULL,
        headcount   INT NOT NULL,
        entered_by  VARCHAR,
        entered_at  TIMESTAMP NOT NULL DEFAULT NOW(),
        notes       TEXT
      );
    `,
  },
  {
    name: "013_user_type_and_department",
    sql: `
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS user_type VARCHAR DEFAULT 'student',
        ADD COLUMN IF NOT EXISTS department VARCHAR;
    `,
  },
  {
    // 013 could not do this. `ADD COLUMN IF NOT EXISTS ... DEFAULT 'student'`
    // is a no-op when the column already exists — and it did, added earlier
    // without a default. The DEFAULT was therefore never applied, so every row
    // (and every future INSERT that omitted the column, which includes
    // /api/auth/sync) landed with user_type = NULL. Verified against the live
    // database: information_schema reported column_default = NULL.
    //
    // Ordering matters: backfill BEFORE SET NOT NULL, or the constraint is
    // rejected by any surviving NULL. Each statement is independently
    // re-runnable, which matters because runMigrations() replays every
    // migration on every boot and only warns on failure.
    name: "014_user_type_default_and_backfill",
    sql: `
      UPDATE users SET user_type = 'student' WHERE user_type IS NULL;
      ALTER TABLE users ALTER COLUMN user_type SET DEFAULT 'student';
      ALTER TABLE users ALTER COLUMN user_type SET NOT NULL;
    `,
  },
  {
    // Organizations directory, Decision 2: an org's type is DERIVED from its
    // name but STORED on the row, so the directory's type filter is a column
    // read rather than a classification pass over 200 names on every request.
    //
    // Nullable on purpose, no DEFAULT. The real rules (whole-word Greek-letter
    // matching plus an honour-society override list) cannot be written in SQL;
    // 016 below only sets the two literal-word cases as a floor, and
    // services/clubTypeSync.ts is what makes every row correct on each boot. A
    // NULL is therefore a legitimate transient state, and serializeClub
    // classifies on read so the API never emits one.
    //
    // No CHECK constraint deliberately: runMigrations only console.warns on
    // failure, so a CHECK that fails to apply is invisible, and a CHECK that
    // does apply would block the reconciler if the value set ever widens.
    // Validity is enforced in TypeScript by the OrgType union.
    //
    // NOTE: `clubs` was created by hand and is not in this file, so against a
    // fresh local database this statement warns and no-ops. Pre-existing gap.
    //
    // Rollback (record only — do NOT add as a migration, it would run every boot):
    //   ALTER TABLE clubs DROP COLUMN IF EXISTS type;
    //   DROP INDEX IF EXISTS idx_clubs_type;
    name: "015_clubs_type",
    sql: `
      ALTER TABLE clubs
        ADD COLUMN IF NOT EXISTS type VARCHAR(16);

      CREATE INDEX IF NOT EXISTS idx_clubs_type ON clubs(type);
    `,
  },
  {
    // 015 could not do this: ADD COLUMN does not retroactively populate existing
    // rows (see 013/014 for the same lesson on users.user_type).
    //
    // This is a FLOOR, not the answer. It handles only names literally
    // containing the whole word "Sorority" or "Fraternity" and leaves everything
    // else NULL rather than guessing 'club' — guessing would hide the
    // Greek-letter names from the reconciler's "what changed" log.
    //
    // \y is Postgres's POSIX word boundary; it is the SQL-side expression of
    // Decision 2's "match whole words, not substrings", which is what keeps
    // "Interfraternity Council" out of the fraternity bucket.
    //
    // Deliberately never overwrites a non-NULL value, so replaying this on every
    // boot cannot stomp what clubTypeSync wrote.
    name: "016_clubs_type_backfill",
    sql: `
      UPDATE clubs SET type = 'sorority'
        WHERE type IS NULL AND name ~* '\\ysorority\\y';

      UPDATE clubs SET type = 'fraternity'
        WHERE type IS NULL AND name ~* '\\yfraternity\\y'
          AND name !~* '\\ysorority\\y'
          AND name !~* '\\yinterfraternity\\y'
          AND name !~* '\\ycouncil\\y';
    `,
  },
  {
    // Decision 3: stars are per-user and live in Postgres so they follow a
    // student across devices (AC 24). created_at is REQUIRED — it is the sole
    // input to the Decision 4 trending tiebreak, and a star without one is
    // unrankable.
    //
    // user_id mirrors event_rsvps: users.id is a VARCHAR PK (001 above), NOT the
    // raw Clerk id. The value always comes from req.userId, never from a body.
    //
    // club_id's REFERENCES was specified as optional pending verification that
    // clubs.club_id really carries a PRIMARY KEY (the table is not in this file,
    // so its live DDL is not in the repo). VERIFIED 2026-08-10 against the shared
    // database: constraint `clubs_pkey`, PRIMARY KEY on club_id. The FK is
    // therefore safe to create and buys automatic cleanup of stars on a deleted
    // club. The read paths do not depend on it — the trending query INNER JOINs
    // through the club_id -> group mapping, so an orphan row would drop out
    // anyway (defence in depth, in case the constraint is ever removed).
    //
    // Rollback (record only): DROP TABLE IF EXISTS org_stars;  -- DESTRUCTIVE
    name: "017_org_stars",
    sql: `
      CREATE TABLE IF NOT EXISTS org_stars (
        user_id    VARCHAR   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        club_id    INTEGER   NOT NULL REFERENCES clubs(club_id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, club_id)
      );

      CREATE INDEX IF NOT EXISTS idx_org_stars_club_created
        ON org_stars(club_id, created_at);
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
