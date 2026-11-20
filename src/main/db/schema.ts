import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Key/value settings. Values are JSON, validated by `settingsSchema` on every read and write. */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
