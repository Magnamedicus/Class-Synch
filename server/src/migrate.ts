import fs from 'node:fs';
import path from 'node:path';
import { pool } from './db';

const isPostgres = (process.env.DATABASE_URL || '').startsWith('postgres');

const DDL_FALLBACK = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  verified TEXT NOT NULL DEFAULT 'false',
  verify_token TEXT,
  verify_expires TIMESTAMP,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY,
  answers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  progress_json JSONB NOT NULL DEFAULT '{"linearIndex":0}'::jsonb,
  last_schedule_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  custom_labels_json JSONB NOT NULL DEFAULT '[]'::jsonb
);
CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  saved_at TIMESTAMP NOT NULL,
  schedule_json JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS backpacks (
  user_id TEXT NOT NULL,
  schedule_hash TEXT NOT NULL,
  state_json JSONB NOT NULL,
  PRIMARY KEY (user_id, schedule_hash)
);
`;

export async function runSqlMigrations() {
  if (!isPostgres) return; // SQLite fallback creates tables in code
  const root = path.resolve(__dirname, '..');
  const dir = path.join(root, 'drizzle');
  if (!fs.existsSync(dir)) {
    // No migration files present; apply minimal DDL so app can run
    try {
      await pool.query(DDL_FALLBACK);
      // eslint-disable-next-line no-console
      console.log('[DB] applied fallback DDL');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[DB] fallback DDL failed:', (e as any)?.message || e);
    }
    return;
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const full = path.join(dir, file);
    const sql = fs.readFileSync(full, 'utf8');
    try {
      await pool.query(sql);
      // eslint-disable-next-line no-console
      console.log(`[DB] applied migration: ${file}`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[DB] migration '${file}' failed or partially applied:`, (e as any)?.message || e);
    }
  }
}

