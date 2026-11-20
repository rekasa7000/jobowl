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
function fakeCipher(available = true): Cipher {
  return {
    isAvailable: () => available,
    encrypt: (plain) => Buffer.from(`enc:${[...plain].reverse().join('')}`),
    decrypt: (data) => [...data.toString().slice(4)].reverse().join(''),
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
  it('round-trips a key and shows only the last four characters as a hint', () => {
    const store = createSecretStore(db, fakeCipher());
    store.set('anthropic_api_key', 'sk-ant-abcdef1234');
    expect(store.get('anthropic_api_key')).toBe('sk-ant-abcdef1234');
    expect(store.hint('anthropic_api_key')).toBe('1234');
  });

  it('never writes the key itself to the database', () => {
    createSecretStore(db, fakeCipher()).set('openai_api_key', 'sk-very-secret-value');
    const rows = db.sqlite.prepare('select * from secrets').all() as Record<string, unknown>[];
    expect(JSON.stringify(rows)).not.toContain('sk-very-secret-value');
  });

  it('replaces an existing key', () => {
    const store = createSecretStore(db, fakeCipher());
    store.set('openai_api_key', 'first-0001');
    store.set('openai_api_key', 'second-0002');
    expect(store.get('openai_api_key')).toBe('second-0002');
    expect(store.hint('openai_api_key')).toBe('0002');
  });

  it('forgets a deleted key', () => {
    const store = createSecretStore(db, fakeCipher());
    store.set('openai_api_key', 'abc-1234');
    store.delete('openai_api_key');
    expect(store.get('openai_api_key')).toBeNull();
    expect(store.hint('openai_api_key')).toBeNull();
  });

  it('refuses to store a key when the system cannot encrypt, rather than saving plain text', () => {
    const store = createSecretStore(db, fakeCipher(false));
    expect(() => store.set('openai_api_key', 'abc')).toThrow(SecretsUnavailableError);
    expect(db.sqlite.prepare('select count(*) as n from secrets').get()).toEqual({ n: 0 });
  });

  it('reports a missing key as null', () => {
    expect(createSecretStore(db, fakeCipher()).get('nothing')).toBeNull();
  });
});
