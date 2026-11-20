import {
  blob,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

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

/** API keys, encrypted by the operating system. Never exported or logged. */
export const secrets = sqliteTable('secrets', {
  name: text('name').primaryKey(),
  ciphertext: blob('ciphertext', { mode: 'buffer' }).notNull(),
  /** Last four characters, shown so you can tell which key is stored. */
  hint: text('hint').notNull(),
  updatedAt: text('updated_at').notNull(),
});

/** Every AI request, for cost tracking and debugging. */
export const aiCalls = sqliteTable(
  'ai_calls',
  {
    id: text('id').primaryKey(),
    layer: text('layer').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    promptVersion: text('prompt_version').notNull(),
    inputTokens: integer('input_tokens').notNull(),
    outputTokens: integer('output_tokens').notNull(),
    cachedInputTokens: integer('cached_input_tokens').notNull(),
    /** Estimated from the price table; null when the model has no known price, 0 for local models. */
    costUsd: real('cost_usd'),
    durationMs: integer('duration_ms').notNull(),
    outcome: text('outcome').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('ai_calls_created_idx').on(table.createdAt)],
);

export const searches = sqliteTable('searches', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  titles: text('titles').notNull(),
  mustHave: text('must_have').notNull(),
  niceToHave: text('nice_to_have').notNull(),
  excludeWords: text('exclude_words').notNull(),
  excludeCompanies: text('exclude_companies').notNull(),
  locations: text('locations').notNull(),
  remoteMode: text('remote_mode').notNull(),
  seniority: text('seniority').notNull(),
  salaryMin: integer('salary_min'),
  salaryCurrency: text('salary_currency'),
  maxAgeDays: integer('max_age_days').notNull(),
  minScoreNotify: integer('min_score_notify').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const sources = sqliteTable('sources', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  label: text('label').notNull(),
  config: text('config').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull(),
  lastRunAt: text('last_run_at'),
  lastStatus: text('last_status'),
  lastError: text('last_error'),
  createdAt: text('created_at').notNull(),
});

export const jobs = sqliteTable(
  'jobs',
  {
    id: text('id').primaryKey(),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    externalId: text('external_id').notNull(),
    url: text('url').notNull(),
    /** The URL with tracking noise removed, to spot the same posting arriving from two sources. */
    urlKey: text('url_key').notNull(),
    applyUrl: text('apply_url'),
    applyKind: text('apply_kind').notNull(),
    company: text('company').notNull(),
    title: text('title').notNull(),
    location: text('location'),
    remoteMode: text('remote_mode').notNull(),
    employmentType: text('employment_type'),
    salaryMin: integer('salary_min'),
    salaryMax: integer('salary_max'),
    salaryCurrency: text('salary_currency'),
    description: text('description').notNull(),
    postedAt: text('posted_at'),
    firstSeenAt: text('first_seen_at').notNull(),
    lastSeenAt: text('last_seen_at').notNull(),
    /** Hash of title and description: when it changes, the job is scored again. */
    contentHash: text('content_hash').notNull(),
    state: text('state').notNull(),
    userState: text('user_state').notNull(),
    dismissReason: text('dismiss_reason'),
    /** The posting contains text that reads like an instruction to an AI. */
    injectionFlag: integer('injection_flag', { mode: 'boolean' }).notNull(),
  },
  (table) => [
    uniqueIndex('jobs_source_external_idx').on(table.sourceId, table.externalId),
    index('jobs_url_key_idx').on(table.urlKey),
    index('jobs_user_state_idx').on(table.userState, table.state),
  ],
);

export const matches = sqliteTable(
  'matches',
  {
    id: text('id').primaryKey(),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    searchId: text('search_id')
      .notNull()
      .references(() => searches.id, { onDelete: 'cascade' }),
    profileVersion: integer('profile_version').notNull(),
    promptVersion: text('prompt_version').notNull(),
    contentHash: text('content_hash').notNull(),
    score: integer('score').notNull(),
    result: text('result').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [uniqueIndex('matches_job_search_idx').on(table.jobId, table.searchId)],
);

export const runs = sqliteTable('runs', {
  id: text('id').primaryKey(),
  trigger: text('trigger').notNull(),
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at'),
  state: text('state').notNull(),
  stats: text('stats').notNull(),
});
