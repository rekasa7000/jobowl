import { eq } from 'drizzle-orm';
import {
  defaultSettings,
  settingsSchema,
  type Settings,
  type SettingsPatch,
} from '@shared/schemas/settings';
import type { Db } from './open';
import { settings } from './schema';

export function readSettings(db: Db): Settings {
  const rows = db.orm.select().from(settings).all();
  const stored: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      stored[row.key] = JSON.parse(row.value);
    } catch {
      // A corrupt value falls back to the default instead of blocking startup.
    }
  }
  const parsed = settingsSchema.safeParse(stored);
  return parsed.success ? parsed.data : defaultSettings;
}

export function writeSettings(db: Db, patch: SettingsPatch): Settings {
  db.orm.transaction((tx) => {
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      const json = JSON.stringify(value);
      const updated = tx.update(settings).set({ value: json }).where(eq(settings.key, key)).run();
      if (updated.changes === 0) tx.insert(settings).values({ key, value: json }).run();
    }
  });
  return readSettings(db);
}
