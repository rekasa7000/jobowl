import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultSettings } from '@shared/schemas/settings';
import { dailyBackup } from '../../src/main/db/backup';
import { openDb, type Db } from '../../src/main/db/open';
import { readSettings, writeSettings } from '../../src/main/db/settings-repo';
import { dataPaths } from '../../src/main/paths';

const migrations = join(import.meta.dirname, '../../drizzle');

let root: string;
let db: Db | undefined;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'jobowl-unit-'));
});

afterEach(() => {
  db?.close();
  db = undefined;
  rmSync(root, { recursive: true, force: true });
});

describe('openDb', () => {
  it('creates the database and applies every migration on a fresh folder', async () => {
    db = await openDb(dataPaths(root), migrations);
    expect(existsSync(join(root, 'jobowl.db'))).toBe(true);
    expect(db.schemaVersion).toBeGreaterThanOrEqual(1);
  });

  it('writes a daily backup and does not repeat it on the same day', async () => {
    db = await openDb(dataPaths(root), migrations);
    const first = readdirSync(join(root, 'backups'));
    expect(first).toHaveLength(1);
    db.close();

    db = await openDb(dataPaths(root), migrations);
    expect(readdirSync(join(root, 'backups'))).toEqual(first);
  });

  it('does not take a pre-migration backup when nothing is pending', async () => {
    db = await openDb(dataPaths(root), migrations);
    db.close();
    db = await openDb(dataPaths(root), migrations);
    expect(readdirSync(join(root, 'backups')).some((f) => f.startsWith('pre-migration'))).toBe(
      false,
    );
  });

  it('takes a pre-migration backup when an existing database is behind', async () => {
    // Open once with only the first migration, as an older release would have left it.
    const older = join(root, 'older-migrations');
    cpSync(migrations, older, { recursive: true });
    const journalPath = join(older, 'meta', '_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: unknown[] };
    journal.entries = journal.entries.slice(0, 1);
    writeFileSync(journalPath, JSON.stringify(journal));

    db = await openDb(dataPaths(root), older);
    expect(db.schemaVersion).toBe(1);
    db.close();

    db = await openDb(dataPaths(root), migrations);
    expect(db.schemaVersion).toBeGreaterThan(1);
    expect(readdirSync(join(root, 'backups')).some((f) => f.startsWith('pre-migration'))).toBe(
      true,
    );
  });
});

describe('dailyBackup', () => {
  it('keeps only the newest 14 daily backups', async () => {
    db = await openDb(dataPaths(root), migrations);
    const dir = join(root, 'backups');
    for (let day = 1; day <= 20; day++) {
      writeFileSync(join(dir, `jobowl-2020-01-${String(day).padStart(2, '0')}.db`), '');
    }
    await dailyBackup(db.sqlite, dir, new Date('2020-02-01T10:00:00Z'));
    const daily = readdirSync(dir).filter((f) => /^jobowl-\d{4}/.test(f));
    expect(daily).toHaveLength(14);
    expect(daily).toContain('jobowl-2020-02-01.db');
    expect(daily).not.toContain('jobowl-2020-01-01.db');
  });
});

describe('settings repository', () => {
  it('returns defaults when nothing is stored', async () => {
    db = await openDb(dataPaths(root), migrations);
    expect(readSettings(db)).toEqual(defaultSettings);
  });

  it('persists updates across a reopen', async () => {
    db = await openDb(dataPaths(root), migrations);
    expect(writeSettings(db, { theme: 'light' })).toEqual({ ...defaultSettings, theme: 'light' });
    db.close();

    db = await openDb(dataPaths(root), migrations);
    expect(readSettings(db).theme).toBe('light');
  });

  it('stores the AI choices and keeps the theme when only they change', async () => {
    db = await openDb(dataPaths(root), migrations);
    writeSettings(db, { theme: 'light' });
    const ai = {
      ...defaultSettings.ai,
      layers: { parser: { provider: 'ollama' as const, model: 'llama3.1' } },
    };
    expect(writeSettings(db, { ai })).toEqual({ ...defaultSettings, theme: 'light', ai });
  });

  it('falls back to the default when a stored value is corrupt', async () => {
    db = await openDb(dataPaths(root), migrations);
    db.sqlite.prepare("insert into settings (key, value) values ('theme', 'not json')").run();
    expect(readSettings(db).theme).toBe('dark');
  });

  it('falls back to the default when a stored value is not a valid theme', async () => {
    db = await openDb(dataPaths(root), migrations);
    db.sqlite.prepare("insert into settings (key, value) values ('theme', '\"neon\"')").run();
    expect(readSettings(db).theme).toBe('dark');
  });
});
