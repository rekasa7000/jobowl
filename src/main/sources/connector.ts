import type { z } from 'zod';
import type { JobRemote, SourceType } from '@shared/schemas/discovery';
import type { Http } from './http';

export type ApplyKind =
  | 'greenhouse_form'
  | 'lever_form'
  | 'ashby_form'
  | 'generic_form'
  | 'email'
  | 'external'
  | 'unknown';

/** A job as a connector found it, before it is stored. */
export interface NormalisedJob {
  externalId: string;
  url: string;
  applyUrl: string | null;
  applyKind: ApplyKind;
  company: string;
  title: string;
  location: string | null;
  remoteMode: JobRemote;
  employmentType: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  description: string;
  postedAt: string | null;
}

export interface FetchContext {
  http: Http;
  /** The name shown for this source; a company board's jobs belong to that company. */
  label: string;
  /** Job titles from the enabled searches, for aggregators that search by keyword. */
  queries: string[];
  secret: (name: string) => Promise<string | null>;
}

export interface FetchResult {
  jobs: NormalisedJob[];
  /** Entries that didn't look like jobs and were left out. */
  skipped: number;
}

export interface Connector<Config> {
  readonly type: SourceType;
  readonly configSchema: z.ZodType<Config>;
  fetch(config: Config, ctx: FetchContext): Promise<FetchResult>;
}

/** Runs `map` over raw entries, counting the ones that don't parse instead of failing the source. */
export function collect<T>(
  raw: unknown[],
  schema: z.ZodType<T>,
  map: (item: T) => NormalisedJob | null,
): FetchResult {
  const jobs: NormalisedJob[] = [];
  let skipped = 0;
  for (const entry of raw) {
    const parsed = schema.safeParse(entry);
    const job = parsed.success ? map(parsed.data) : null;
    if (job) jobs.push(job);
    else skipped += 1;
  }
  return { jobs, skipped };
}
