import type { JobRemote, Search } from '@shared/schemas/discovery';

/** What the hard filter needs to know about a job. */
export interface FilterableJob {
  company: string;
  title: string;
  location: string | null;
  remoteMode: JobRemote;
  description: string;
  salaryMax: number | null;
  salaryCurrency: string | null;
  postedAt: string | null;
  firstSeenAt: string;
}

export type FilterSearch = Pick<
  Search,
  | 'titles'
  | 'mustHave'
  | 'excludeWords'
  | 'excludeCompanies'
  | 'locations'
  | 'remoteMode'
  | 'salaryMin'
  | 'salaryCurrency'
  | 'maxAgeDays'
>;

/** Words that say how senior a role is, not what it is, so they don't count as a title match. */
const LEVEL_WORDS = new Set([
  'senior',
  'junior',
  'lead',
  'staff',
  'principal',
  'head',
  'the',
  'and',
  'for',
]);

const has = (haystack: string, needle: string): boolean => haystack.includes(needle.toLowerCase());

/**
 * Cheap, certain rules that run before any AI call, so most jobs never cost anything.
 * Unknown facts pass: a job with no salary or location isn't excluded for lacking one.
 * Returns why a job was dropped, or null if it passes.
 */
export function rejectReason(job: FilterableJob, search: FilterSearch, now: Date): string | null {
  const title = job.title.toLowerCase();
  const text = `${title} ${job.description.toLowerCase()}`;

  if (search.excludeCompanies.some((name) => has(job.company.toLowerCase(), name)))
    return 'excluded company';
  if (search.excludeWords.some((word) => has(text, word))) return 'excluded word';

  const posted = Date.parse(job.postedAt ?? job.firstSeenAt);
  if (!Number.isNaN(posted) && now.getTime() - posted > search.maxAgeDays * 86_400_000)
    return 'too old';

  if (
    search.remoteMode !== 'any' &&
    job.remoteMode !== 'unknown' &&
    job.remoteMode !== search.remoteMode
  ) {
    return 'wrong remote mode';
  }
  if (search.locations.length > 0 && job.remoteMode !== 'remote' && job.location) {
    const where = job.location.toLowerCase();
    if (!search.locations.some((place) => has(where, place))) return 'location';
  }

  if (search.mustHave.length > 0 && !search.mustHave.some((word) => has(text, word)))
    return 'missing must-have';

  if (search.titles.length > 0) {
    const tokens = search.titles
      .flatMap((t) => t.toLowerCase().split(/[^\p{L}\p{N}+#.]+/u))
      .filter((token) => token.length >= 3 && !LEVEL_WORDS.has(token));
    if (tokens.length > 0 && !tokens.some((token) => title.includes(token))) return 'title';
  }

  if (
    search.salaryMin !== null &&
    job.salaryMax !== null &&
    (job.salaryCurrency === null ||
      search.salaryCurrency === null ||
      job.salaryCurrency === search.salaryCurrency) &&
    job.salaryMax < search.salaryMin
  ) {
    return 'salary below floor';
  }
  return null;
}
