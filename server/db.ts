import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { mkdir } from "node:fs/promises";

export interface Database {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
  close(): Promise<void>;
}
const schema = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
    password_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    csrf TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id)",
  `CREATE TABLE IF NOT EXISTS portfolios (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 0, data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
];
export async function openDatabase(
  options: { url?: string; directory?: string } = {},
): Promise<Database> {
  let db: Database;
  if (options.url) {
    const pool = new pg.Pool({ connectionString: options.url, max: 5 });
    db = {
      query: async (sql, params) => pool.query(sql, params),
      close: () => pool.end(),
    };
  } else {
    if (options.directory)
      await mkdir(options.directory, { recursive: true, mode: 0o700 });
    const lite = new PGlite(options.directory);
    db = {
      query: (sql, params) => lite.query(sql, params),
      close: () => lite.close(),
    };
  }
  for (const statement of schema) await db.query(statement);
  return db;
}
