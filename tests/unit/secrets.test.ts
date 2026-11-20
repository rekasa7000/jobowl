import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../../src/main/db/open';
import { dataPaths } from '../../src/main/paths';
import {
  createSecretStore,
  SecretsUnavailableError,
  type Cipher,
} from '../../src/main/secrets/secret-store';

const migrations = join(import.meta.dirname, '../../drizzle');

/** Stands in for Windows encryption: reversible, and visibly not the plain text. */
function fakeCipher(available = true, rotated = false): Cipher {
  return {
    isAvailable: () => Promise.resolve(available),
    encrypt: (plain) =>
      Promise.resolve(Buffer.from(`enc:${Buffer.from(plain).toString('base64')}`)),
    decrypt: (data) =>
      Promise.resolve({
        text: Buffer.from(data.toString().slice(4), 'base64').toString(),
        reEncrypt: rotated,
      }),
  };
}

let root: string;
let db: Db;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'jobowl-secrets-'));
  db = await openDb(dataPaths(root), migrations);
});

afterEach(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});

describe('secret store', () => {
  it('round-trips a key and shows only the last four characters as a hint', async () => {
    const store = createSecretStore(db, fakeCipher());
    await store.set('anthropic_api_key', 'sk-ant-abcdef1234');
    expect(await store.get('anthropic_api_key')).toBe('sk-ant-abcdef1234');
    expect(store.hint('anthropic_api_key')).toBe('1234');
  });

  it('never writes the key itself to the database', async () => {
    await createSecretStore(db, fakeCipher()).set('openai_api_key', 'sk-very-secret-value');
    const rows = db.sqlite.prepare('select * from secrets').all() as Record<string, unknown>[];
    expect(JSON.stringify(rows)).not.toContain('sk-very-secret-value');
  });

  it('replaces an existing key', async () => {
    const store = createSecretStore(db, fakeCipher());
    await store.set('openai_api_key', 'first-0001');
    await store.set('openai_api_key', 'second-0002');
    expect(await store.get('openai_api_key')).toBe('second-0002');
    expect(store.hint('openai_api_key')).toBe('0002');
  });

  it('forgets a deleted key', async () => {
    const store = createSecretStore(db, fakeCipher());
    await store.set('openai_api_key', 'abc-1234');
    store.delete('openai_api_key');
    expect(await store.get('openai_api_key')).toBeNull();
    expect(store.hint('openai_api_key')).toBeNull();
  });

  it('refuses to store a key when the system cannot encrypt, rather than saving plain text', async () => {
    const store = createSecretStore(db, fakeCipher(false));
    await expect(store.set('openai_api_key', 'abc')).rejects.toThrow(SecretsUnavailableError);
    expect(db.sqlite.prepare('select count(*) as n from secrets').get()).toEqual({ n: 0 });
  });

  it('reports a missing key as null', async () => {
    expect(await createSecretStore(db, fakeCipher()).get('nothing')).toBeNull();
  });

  it('saves a key again when the system says its encryption key has rotated', async () => {
    await createSecretStore(db, fakeCipher()).set('openai_api_key', 'sk-keep-me-9999');
    const before = db.sqlite.prepare('select updated_at from secrets').get() as {
      updated_at: string;
    };

    const rotated = createSecretStore(
      db,
      fakeCipher(true, true),
      () => new Date(Date.now() + 60_000),
    );
    expect(await rotated.get('openai_api_key')).toBe('sk-keep-me-9999');

    const after = db.sqlite.prepare('select updated_at from secrets').get() as {
      updated_at: string;
    };
    expect(after.updated_at).not.toBe(before.updated_at);
    expect(rotated.hint('openai_api_key')).toBe('9999');
  });
});
