import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { DataPaths } from '../paths';
import { dailyBackup, preMigrationBackup } from './backup';
import * as schema from './schema';

export interface Db {
  sqlite: Database.Database;
  orm: BetterSQLite3Database<typeof schema>;
  /** Number of migrations applied. Shown in the app so a mismatch is easy to spot. */
  schemaVersion: number;
  close(): void;
}

function migrationCount(migrationsDir: string): number {
  const journal = JSON.parse(
    readFileSync(join(migrationsDir, 'meta', '_journal.json'), 'utf8'),
  ) as {
    entries: unknown[];
  };
  return journal.entries.length;
}

function appliedCount(sqlite: Database.Database): number {
  const table = sqlite
    .prepare(
      "select name from sqlite_master where type = 'table' and name = '__drizzle_migrations'",
    )
    .get();
  if (!table) return 0;
  const row = sqlite.prepare('select count(*) as n from __drizzle_migrations').get() as {
    n: number;
  };
  return row.n;
}

/** Opens the database, backs it up if a migration is about to change it, and migrates. */
export async function openDb(paths: DataPaths, migrationsDir: string): Promise<Db> {
  mkdirSync(paths.root, { recursive: true });
  const existed = existsSync(paths.db);

  const sqlite = new Database(paths.db);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  const total = migrationCount(migrationsDir);
  if (existed && appliedCount(sqlite) < total) {
    await preMigrationBackup(sqlite, paths.backups);
  }

  const orm = drizzle(sqlite, { schema });
  migrate(orm, { migrationsFolder: migrationsDir });

  await dailyBackup(sqlite, paths.backups);

  return { sqlite, orm, schemaVersion: appliedCount(sqlite), close: () => sqlite.close() };
}
