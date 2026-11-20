import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Key/value settings. Values are JSON, validated by `settingsSchema` on every read and write. */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const applications = sqliteTable(
  'applications',
  {
    id: text('id').primaryKey(),
    /** The numeric id from a jobowl 0.1 file, so importing twice never duplicates. */
    legacyId: integer('legacy_id').unique(),
    company: text('company').notNull(),
    position: text('position').notNull(),
    status: text('status').notNull(),
    channel: text('channel').notNull(),
    dateApplied: text('date_applied'),
    notes: text('notes').notNull().default(''),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    lastActivityAt: text('last_activity_at').notNull(),
  },
  (table) => [index('applications_status_idx').on(table.status)],
);

export const applicationEvents = sqliteTable(
  'application_events',
  {
    id: text('id').primaryKey(),
    applicationId: text('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    at: text('at').notNull(),
    kind: text('kind').notNull(),
    details: text('details').notNull().default('{}'),
  },
  (table) => [index('application_events_app_idx').on(table.applicationId, table.at)],
);

/** Immutable, numbered snapshots of the profile. The highest version is the current one. */
export const profileVersions = sqliteTable('profile_versions', {
  id: text('id').primaryKey(),
  version: integer('version').notNull().unique(),
  data: text('data').notNull(),
  note: text('note'),
  /** File name of the resume this version was imported from, for display. */
  sourceName: text('source_name'),
  /** Path of the kept copy of that resume, relative to the data folder. */
  sourcePath: text('source_path'),
  sourceSha256: text('source_sha256'),
  createdAt: text('created_at').notNull(),
});
