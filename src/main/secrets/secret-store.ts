import { eq } from 'drizzle-orm';
import type { Db } from '../db/open';
import { secrets } from '../db/schema';

/** The operating system's encryption. In the app this is Electron's `safeStorage` (Windows DPAPI). */
export interface Cipher {
  isAvailable(): boolean;
  encrypt(plain: string): Buffer;
  decrypt(encrypted: Buffer): string;
}

export class SecretsUnavailableError extends Error {
  constructor() {
    super(
      "Windows can't encrypt secrets for this account, so jobowl won't store API keys in plain text.",
    );
  }
}

export function createSecretStore(db: Db, cipher: Cipher, clock: () => Date = () => new Date()) {
  const { orm } = db;
  return {
    available: () => cipher.isAvailable(),

    set(name: string, value: string): void {
      if (!cipher.isAvailable()) throw new SecretsUnavailableError();
      const row = {
        name,
        ciphertext: cipher.encrypt(value),
        hint: value.slice(-4),
        updatedAt: clock().toISOString(),
      };
      orm.insert(secrets).values(row).onConflictDoUpdate({ target: secrets.name, set: row }).run();
    },

    get(name: string): string | null {
      const row = orm.select().from(secrets).where(eq(secrets.name, name)).get();
      if (!row) return null;
      if (!cipher.isAvailable()) throw new SecretsUnavailableError();
      return cipher.decrypt(row.ciphertext);
    },

    /** The last four characters, or null if nothing is stored. Never decrypts. */
    hint(name: string): string | null {
      return orm.select().from(secrets).where(eq(secrets.name, name)).get()?.hint ?? null;
    },

    delete(name: string): void {
      orm.delete(secrets).where(eq(secrets.name, name)).run();
    },
  };
}

export type SecretStore = ReturnType<typeof createSecretStore>;
