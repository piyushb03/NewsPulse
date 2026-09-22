/**
 * db.ts — Database connection for News Pulse backend.
 *
 * Uses @libsql/client which supports both:
 *   - SQLite files via file:// URLs (local dev)
 *   - Turso/LibSQL remote databases (production)
 *   - Standard Postgres via pg (production with DATABASE_URL=postgresql://...)
 *
 * DATABASE_URL formats:
 *   SQLite:   file:///absolute/path/to/news_pulse.db  (or relative: file:news_pulse.db)
 *             Also accepts sqlite:///path/to/news_pulse.db (converted automatically)
 *   Postgres: postgresql://user:pass@host:5432/dbname
 *   Turso:    libsql://yourdb.turso.io?authToken=...
 */
import path from 'path';
import { createClient, Client } from '@libsql/client';

const DATABASE_URL = process.env.DATABASE_URL || 'sqlite:///news_pulse.db';

function isPostgres(): boolean {
  return DATABASE_URL.startsWith('postgresql') || DATABASE_URL.startsWith('postgres');
}

function buildLibsqlUrl(): string {
  // Convert sqlite:///path to file:///path for @libsql/client
  if (DATABASE_URL.startsWith('sqlite:///')) {
    const rawPath = DATABASE_URL.slice('sqlite:///'.length);
    // Resolve relative paths from the scraper directory (where the DB lives)
    const scraperDir = process.env.SCRAPER_PATH
      ? path.dirname(path.resolve(process.cwd(), process.env.SCRAPER_PATH))
      : path.resolve(process.cwd(), '../scraper');
    const absPath = path.isAbsolute(rawPath) ? rawPath : path.resolve(scraperDir, rawPath);
    // On Windows, libsql needs forward slashes
    return `file:${absPath.replace(/\\/g, '/')}`;
  }
  if (DATABASE_URL.startsWith('sqlite://')) {
    const rawPath = DATABASE_URL.slice('sqlite://'.length);
    const scraperDir = process.env.SCRAPER_PATH
      ? path.dirname(path.resolve(process.cwd(), process.env.SCRAPER_PATH))
      : path.resolve(process.cwd(), '../scraper');
    const absPath = path.isAbsolute(rawPath) ? rawPath : path.resolve(scraperDir, rawPath);
    return `file:${absPath.replace(/\\/g, '/')}`;
  }
  // file:/// or libsql:// — pass through
  return DATABASE_URL;
}

// ── Client singleton ──────────────────────────────────────────────────────────
let _client: Client | null = null;

function getClient(): Client {
  if (!_client) {
    if (isPostgres()) {
      throw new Error(
        'Postgres support requires the pg package. Set DATABASE_URL to a SQLite or LibSQL URL for now.'
      );
    }
    const url = buildLibsqlUrl();
    console.log(`[db] Connecting to: ${url}`);
    _client = createClient({ url });
  }
  return _client;
}

// ── Unified query interface ───────────────────────────────────────────────────

export async function queryAll<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const client = getClient();
  const result = await client.execute({ sql, args: params as (string | number | null)[] });
  return result.rows as unknown as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | undefined> {
  const rows = await queryAll<T>(sql, params);
  return rows[0];
}

export { isPostgres };
