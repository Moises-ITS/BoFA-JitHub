import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import { Pool } from "pg";
import {
  rawStudents,
  cleanText,
  splitClubList,
  canonicalClubName,
  studentProperties,
  inferredInterests,
} from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function normalizedClubList(rawClubField) {
  const clubs = splitClubList(rawClubField).map(canonicalClubName).filter(Boolean);
  return [...new Set(clubs)];
}

function normalizedCompanies(rawCompaniesField) {
  const text = cleanText(rawCompaniesField);
  if (!text) return [];
  return text
    .split(/\s*,\s*/)
    .map((item) => cleanText(item))
    .filter(Boolean);
}

async function tableExists(client, tableName) {
  const result = await client.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = $1
     ) AS exists`,
    [tableName]
  );
  return result.rows[0]?.exists === true;
}

async function resetAndSeed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Remove user-dependent rows first, then users.
    if (await tableExists(client, "connection_requests")) {
      await client.query("DELETE FROM connection_requests");
    }
    if (await tableExists(client, "user_notifications")) {
      await client.query("DELETE FROM user_notifications");
    }
    if (await tableExists(client, "password_reset_tokens")) {
      await client.query("DELETE FROM password_reset_tokens");
    }
    if (await tableExists(client, "user_chat_memory")) {
      await client.query("DELETE FROM user_chat_memory");
    }
    await client.query("DELETE FROM users");

    // Optional standalone clubs table wipe + reseed.
    const hasClubsTable = await tableExists(client, "clubs");
    if (hasClubsTable) {
      await client.query("DELETE FROM clubs");
    }

    const allClubs = new Set();
    let insertedUsers = 0;

    for (const raw of rawStudents) {
      const student = studentProperties(raw);
      const id = student.studentId ? `student-${student.studentId}` : null;
      if (!id) continue;

      const clubs = normalizedClubList(raw.clubs);
      clubs.forEach((club) => allClubs.add(club));
      const companies = normalizedCompanies(raw.companies);
      const interests = inferredInterests(raw.major);

      await client.query(
        `INSERT INTO users (
          id, email, name, password_hash, major, graduation_year, clubs, companies, interests, graph_node_id
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
        )`,
        [
          id,
          student.email ?? null,
          student.name ?? null,
          student.passwordHash ?? null,
          student.major ?? null,
          student.graduationYear ?? null,
          clubs,
          companies,
          interests,
          id,
        ]
      );
      insertedUsers += 1;
    }

    if (hasClubsTable) {
      for (const clubName of allClubs) {
        await client.query(
          `INSERT INTO clubs (club_name)
           VALUES ($1)`,
          [clubName]
        );
      }
    }

    await client.query("COMMIT");

    console.log(`PostgreSQL reset complete.`);
    console.log(`Users inserted: ${insertedUsers}`);
    if (hasClubsTable) {
      console.log(`Clubs inserted: ${allClubs.size}`);
    } else {
      console.log(`No public.clubs table found. User clubs[] fields were still reseeded.`);
    }
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

resetAndSeed().catch((error) => {
  console.error("PostgreSQL reset/seed failed:", error);
  process.exitCode = 1;
});
