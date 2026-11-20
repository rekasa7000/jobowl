import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type Database from 'better-sqlite3';

const KEEP = 14;
const DAILY = /^jobowl-(\d{4}-\d{2}-\d{2})\.db$/;

function today(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** One backup per calendar day, newest 14 kept. Returns the path written, or null if today's exists. */
export async function dailyBackup(
  db: Database.Database,
  dir: string,
  now = new Date(),
): Promise<string | null> {
  mkdirSync(dir, { recursive: true });
  const name = `jobowl-${today(now)}.db`;
  const existing = readdirSync(dir);
  if (existing.includes(name)) return null;

  const dest = join(dir, name);
  await db.backup(dest);

  const daily = readdirSync(dir)
    .filter((f) => DAILY.test(f))
    .sort();
  for (const old of daily.slice(0, Math.max(0, daily.length - KEEP))) {
    rmSync(join(dir, old));
  }
  return dest;
}

/** Taken before a migration changes an existing database. Kept separate from the daily rotation. */
export async function preMigrationBackup(
  db: Database.Database,
  dir: string,
  now = new Date(),
): Promise<string> {
  mkdirSync(dir, { recursive: true });
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const dest = join(dir, `pre-migration-${stamp}.db`);
  await db.backup(dest);
  return dest;
}
