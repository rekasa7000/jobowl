import { z } from 'zod';
import { idSchema } from './application';

const words = z.array(z.string().trim().min(1).max(100)).max(30);

export const remoteModeSchema = z.enum(['remote', 'hybrid', 'onsite', 'any']);
export const jobRemoteSchema = z.enum(['remote', 'hybrid', 'onsite', 'unknown']);
export type JobRemote = z.infer<typeof jobRemoteSchema>;

export const seniorityOptions = ['junior', 'mid', 'senior', 'lead', 'principal'] as const;

/** What the person is looking for. No defaults: an update changes only what it names. */
export const searchFieldsSchema = z.object({
  name: z.string().trim().min(1, 'Give the search a name').max(100),
  titles: words,
  mustHave: words,
  niceToHave: words,
  excludeWords: words,
  excludeCompanies: words,
  locations: words,
  remoteMode: remoteModeSchema,
  seniority: z.array(z.enum(seniorityOptions)).max(5),
  salaryMin: z.number().int().min(0).max(100_000_000).nullable(),
  salaryCurrency: z
    .string()
    .regex(/^[A-Z]{3}$/, 'Use a 3-letter code like USD or PHP')
    .nullable(),
  maxAgeDays: z.number().int().min(1).max(365),
  minScoreNotify: z.number().int().min(0).max(100),
  enabled: z.boolean(),
});
export type SearchFields = z.infer<typeof searchFieldsSchema>;

export const searchSchema = searchFieldsSchema.extend({
  id: idSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Search = z.infer<typeof searchSchema>;

export const searchPatchSchema = z.object({
  id: idSchema,
  patch: searchFieldsSchema.partial().strict(),
});

export function defaultSearch(): SearchFields {
  return {
    name: '',
    titles: [],
    mustHave: [],
    niceToHave: [],
    excludeWords: [],
    excludeCompanies: [],
    locations: [],
    remoteMode: 'any',
    seniority: [],
    salaryMin: null,
    salaryCurrency: null,
    maxAgeDays: 30,
    minScoreNotify: 75,
    enabled: true,
  };
}

export const sourceTypeSchema = z.enum([
  'greenhouse',
  'lever',
  'ashby',
  'remotive',
  'remoteok',
  'arbeitnow',
  'adzuna',
]);
export type SourceType = z.infer<typeof sourceTypeSchema>;

export const SOURCE_LABELS: Record<SourceType, string> = {
  greenhouse: 'Greenhouse job board',
  lever: 'Lever job board',
  ashby: 'Ashby job board',
  remotive: 'Remotive (remote jobs)',
  remoteok: 'RemoteOK (remote jobs)',
  arbeitnow: 'Arbeitnow',
  adzuna: 'Adzuna',
};

/** Connector settings. A board name or country, never a secret. */
export const sourceConfigSchema = z.record(z.string(), z.string().max(200));
export type SourceConfig = z.infer<typeof sourceConfigSchema>;

export const sourceStatusSchema = z.enum(['ok', 'error', 'rate_limited', 'blocked']);

export const sourceSchema = z.object({
  id: idSchema,
  type: sourceTypeSchema,
  label: z.string(),
  config: sourceConfigSchema,
  enabled: z.boolean(),
  lastRunAt: z.string().nullable(),
  lastStatus: sourceStatusSchema.nullable(),
  lastError: z.string().nullable(),
});
export type Source = z.infer<typeof sourceSchema>;

export const addSourceSchema = z.object({
  type: sourceTypeSchema,
  config: sourceConfigSchema,
  label: z.string().trim().max(100).optional(),
});
export const detectSourceSchema = z.object({ url: z.string().trim().min(1).max(500) });
export const detectedSourceSchema = z
  .object({ type: sourceTypeSchema, config: sourceConfigSchema, label: z.string() })
  .nullable();

export const jobStateSchema = z.enum(['new', 'shortlisted', 'dismissed']);
export type JobState = z.infer<typeof jobStateSchema>;

export const verdictSchema = z.enum(['strong', 'possible', 'weak', 'no']);
export type Verdict = z.infer<typeof verdictSchema>;

export const scoreResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  verdict: verdictSchema,
  summary: z.string(),
  /** Each requirement from the posting, with the ids of the profile items that show it. */
  matched: z.array(z.object({ requirement: z.string(), evidence: z.array(z.string()) })),
  gaps: z.array(z.object({ requirement: z.string(), severity: z.enum(['minor', 'major']) })),
  dealbreakers: z.array(z.string()),
  seniorityFit: z.enum(['below', 'match', 'above', 'unknown']),
});
export type ScoreResult = z.infer<typeof scoreResultSchema>;

export const feedItemSchema = z.object({
  id: idSchema,
  company: z.string(),
  title: z.string(),
  location: z.string().nullable(),
  remoteMode: jobRemoteSchema,
  sourceLabel: z.string(),
  url: z.string(),
  postedAt: z.string().nullable(),
  firstSeenAt: z.string(),
  userState: jobStateSchema,
  /** The best score across searches, or null if it hasn't been scored. */
  score: z.number().int().nullable(),
  verdict: verdictSchema.nullable(),
  summary: z.string().nullable(),
  isNew: z.boolean(),
  injectionWarning: z.boolean(),
});
export type FeedItem = z.infer<typeof feedItemSchema>;

export const jobDetailSchema = feedItemSchema.extend({
  description: z.string(),
  salary: z.string().nullable(),
  dismissReason: z.string().nullable(),
  matches: z.array(z.object({ searchName: z.string(), result: scoreResultSchema })),
});
export type JobDetail = z.infer<typeof jobDetailSchema>;

export const jobFilterSchema = z.object({
  state: z.union([jobStateSchema, z.literal('open')]).optional(),
  minScore: z.number().int().min(0).max(100).optional(),
  text: z.string().max(200).optional(),
  sourceId: idSchema.optional(),
});
export type JobFilter = z.infer<typeof jobFilterSchema>;

export const setJobStateSchema = z.object({
  id: idSchema,
  state: jobStateSchema,
  reason: z.string().trim().max(200).optional(),
});

export const runStateSchema = z.enum(['running', 'done', 'partial', 'failed', 'stopped_cap']);
export const runStatsSchema = z.object({
  sources: z.array(
    z.object({
      label: z.string(),
      status: sourceStatusSchema,
      fetched: z.number().int(),
      added: z.number().int(),
      skipped: z.number().int(),
      error: z.string().optional(),
    }),
  ),
  filteredOut: z.number().int(),
  scored: z.number().int(),
  scoreFailures: z.number().int(),
  /** Why scoring didn't happen or stopped early, in a sentence. */
  scoringNote: z.string().nullable(),
});
export type RunStats = z.infer<typeof runStatsSchema>;

export const runStatusSchema = z.object({
  running: z.boolean(),
  phase: z.string(),
  message: z.string(),
  last: z
    .object({
      id: idSchema,
      trigger: z.enum(['launch', 'timer', 'manual']),
      startedAt: z.string(),
      finishedAt: z.string().nullable(),
      state: runStateSchema,
      stats: runStatsSchema,
    })
    .nullable(),
});
export type RunStatus = z.infer<typeof runStatusSchema>;
