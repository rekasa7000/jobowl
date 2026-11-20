import { and, desc, eq, inArray, lt, ne } from 'drizzle-orm';
import {
  scoreResultSchema,
  type FeedItem,
  type JobDetail,
  type JobFilter,
  type JobState,
  type RunStats,
  type ScoreResult,
  type Search,
  type SearchFields,
  type Source,
  type SourceConfig,
  type SourceType,
} from '@shared/schemas/discovery';
import { ulid } from '../ids';
import { rejectReason, type FilterableJob } from '../jobs/filter';
import { looksLikeInstructionToAi } from '../jobs/injection';
import type { NormalisedJob } from '../sources/connector';
import { canonicalUrl, contentHash } from '../sources/normalise';
import type { Db } from './open';
import { jobs, matches, runs, searches, sources } from './schema';

type JobRow = typeof jobs.$inferSelect;
const DAY = 86_400_000;
/** A job not returned by a successful fetch for this long is treated as closed. */
const CLOSED_AFTER_DAYS = 3;

/** A patch from the renderer may carry keys set to undefined; those mean "leave alone". */
function definedOnly<T extends object>(patch: T): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as {
    [K in keyof T]?: Exclude<T[K], undefined>;
  };
}

// The return type is the caller's claim about what was stored; these columns are only written by this file.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
const json = <T>(value: string): T => JSON.parse(value) as T;

function toSearch(row: typeof searches.$inferSelect): Search {
  return {
    id: row.id,
    name: row.name,
    titles: json(row.titles),
    mustHave: json(row.mustHave),
    niceToHave: json(row.niceToHave),
    excludeWords: json(row.excludeWords),
    excludeCompanies: json(row.excludeCompanies),
    locations: json(row.locations),
    remoteMode: row.remoteMode as Search['remoteMode'],
    seniority: json(row.seniority),
    salaryMin: row.salaryMin,
    salaryCurrency: row.salaryCurrency,
    maxAgeDays: row.maxAgeDays,
    minScoreNotify: row.minScoreNotify,
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toSource(row: typeof sources.$inferSelect): Source {
  return {
    id: row.id,
    type: row.type as SourceType,
    label: row.label,
    config: json<SourceConfig>(row.config),
    enabled: row.enabled,
    lastRunAt: row.lastRunAt,
    lastStatus: row.lastStatus as Source['lastStatus'],
    lastError: row.lastError,
  };
}

function salaryText(row: JobRow): string | null {
  if (row.salaryMin === null && row.salaryMax === null) return null;
  const fmt = (n: number) => n.toLocaleString('en-US');
  const range =
    row.salaryMin !== null && row.salaryMax !== null && row.salaryMin !== row.salaryMax
      ? `${fmt(row.salaryMin)} to ${fmt(row.salaryMax)}`
      : fmt(row.salaryMin ?? row.salaryMax ?? 0);
  return `${range} ${row.salaryCurrency ?? ''} a year`.replace('  ', ' ').trim();
}

function filterable(row: JobRow): FilterableJob {
  return {
    company: row.company,
    title: row.title,
    location: row.location,
    remoteMode: row.remoteMode as FilterableJob['remoteMode'],
    description: row.description,
    salaryMax: row.salaryMax,
    salaryCurrency: row.salaryCurrency,
    postedAt: row.postedAt,
    firstSeenAt: row.firstSeenAt,
  };
}

export function createDiscoveryRepo(db: Db, clock: () => Date = () => new Date()) {
  const { orm } = db;
  const stamp = () => clock().toISOString();

  const allSearches = (): Search[] => orm.select().from(searches).all().map(toSearch);
  const enabledSearches = (): Search[] => allSearches().filter((s) => s.enabled);

  return {
    // Searches
    listSearches: allSearches,
    enabledSearches,

    createSearch(fields: SearchFields): Search {
      const id = ulid();
      const now = stamp();
      orm
        .insert(searches)
        .values({
          id,
          name: fields.name,
          titles: JSON.stringify(fields.titles),
          mustHave: JSON.stringify(fields.mustHave),
          niceToHave: JSON.stringify(fields.niceToHave),
          excludeWords: JSON.stringify(fields.excludeWords),
          excludeCompanies: JSON.stringify(fields.excludeCompanies),
          locations: JSON.stringify(fields.locations),
          remoteMode: fields.remoteMode,
          seniority: JSON.stringify(fields.seniority),
          salaryMin: fields.salaryMin,
          salaryCurrency: fields.salaryCurrency,
          maxAgeDays: fields.maxAgeDays,
          minScoreNotify: fields.minScoreNotify,
          enabled: fields.enabled,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      return toSearch(
        orm
          .select()
          .from(searches)
          .where(eq(searches.id, id))
          .get() as typeof searches.$inferSelect,
      );
    },

    updateSearch(
      id: string,
      patch: { [K in keyof SearchFields]?: SearchFields[K] | undefined },
    ): Search {
      const row = orm.select().from(searches).where(eq(searches.id, id)).get();
      if (!row) throw new Error('That search no longer exists.');
      const next: SearchFields = { ...toSearch(row), ...definedOnly(patch) };
      orm
        .update(searches)
        .set({
          name: next.name,
          titles: JSON.stringify(next.titles),
          mustHave: JSON.stringify(next.mustHave),
          niceToHave: JSON.stringify(next.niceToHave),
          excludeWords: JSON.stringify(next.excludeWords),
          excludeCompanies: JSON.stringify(next.excludeCompanies),
          locations: JSON.stringify(next.locations),
          remoteMode: next.remoteMode,
          seniority: JSON.stringify(next.seniority),
          salaryMin: next.salaryMin,
          salaryCurrency: next.salaryCurrency,
          maxAgeDays: next.maxAgeDays,
          minScoreNotify: next.minScoreNotify,
          enabled: next.enabled,
          updatedAt: stamp(),
        })
        .where(eq(searches.id, id))
        .run();
      return toSearch(
        orm
          .select()
          .from(searches)
          .where(eq(searches.id, id))
          .get() as typeof searches.$inferSelect,
      );
    },

    deleteSearch(id: string): void {
      orm.delete(searches).where(eq(searches.id, id)).run();
    },

    // Sources
    listSources: (): Source[] => orm.select().from(sources).all().map(toSource),
    enabledSources: (): Source[] =>
      orm.select().from(sources).where(eq(sources.enabled, true)).all().map(toSource),

    addSource(type: SourceType, config: SourceConfig, label: string): Source {
      const existing = orm.select().from(sources).where(eq(sources.type, type)).all().map(toSource);
      if (existing.some((s) => JSON.stringify(s.config) === JSON.stringify(config))) {
        throw new Error('That source is already in your list.');
      }
      const id = ulid();
      orm
        .insert(sources)
        .values({
          id,
          type,
          label,
          config: JSON.stringify(config),
          enabled: true,
          createdAt: stamp(),
        })
        .run();
      return toSource(
        orm.select().from(sources).where(eq(sources.id, id)).get() as typeof sources.$inferSelect,
      );
    },

    updateSource(
      id: string,
      patch: { enabled?: boolean | undefined; label?: string | undefined },
    ): Source {
      orm
        .update(sources)
        .set({
          ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
          ...(patch.label !== undefined ? { label: patch.label } : {}),
        })
        .where(eq(sources.id, id))
        .run();
      const row = orm.select().from(sources).where(eq(sources.id, id)).get();
      if (!row) throw new Error('That source no longer exists.');
      return toSource(row);
    },

    deleteSource(id: string): void {
      orm.delete(sources).where(eq(sources.id, id)).run();
    },

    recordSourceRun(
      id: string,
      status: NonNullable<Source['lastStatus']>,
      error: string | null,
    ): void {
      orm
        .update(sources)
        .set({ lastRunAt: stamp(), lastStatus: status, lastError: error })
        .where(eq(sources.id, id))
        .run();
    },

    // Jobs
    /** Stores fetched jobs. A job already known from the same source is updated; one that matches a job from another source is dropped as a duplicate. */
    upsertJobs(
      sourceId: string,
      incoming: NormalisedJob[],
    ): { added: number; updated: number; duplicates: number } {
      const now = clock();
      const nowIso = now.toISOString();
      let added = 0;
      let updated = 0;
      let duplicates = 0;

      orm.transaction((tx) => {
        for (const job of incoming) {
          const hash = contentHash(job.title, job.description);
          const known = tx
            .select()
            .from(jobs)
            .where(and(eq(jobs.sourceId, sourceId), eq(jobs.externalId, job.externalId)))
            .get();
          const fields = {
            url: job.url,
            urlKey: canonicalUrl(job.url),
            applyUrl: job.applyUrl,
            applyKind: job.applyKind,
            company: job.company,
            title: job.title,
            location: job.location,
            remoteMode: job.remoteMode,
            employmentType: job.employmentType,
            salaryMin: job.salaryMin,
            salaryMax: job.salaryMax,
            salaryCurrency: job.salaryCurrency,
            description: job.description,
            postedAt: job.postedAt,
            lastSeenAt: nowIso,
            contentHash: hash,
            state: 'active',
            injectionFlag: looksLikeInstructionToAi(`${job.title}\n${job.description}`),
          };
          if (known) {
            tx.update(jobs).set(fields).where(eq(jobs.id, known.id)).run();
            updated += 1;
            continue;
          }

          const recent = new Date(now.getTime() - 30 * DAY).toISOString();
          const twin = tx
            .select({
              id: jobs.id,
              company: jobs.company,
              title: jobs.title,
              location: jobs.location,
              firstSeenAt: jobs.firstSeenAt,
              urlKey: jobs.urlKey,
            })
            .from(jobs)
            .where(and(ne(jobs.sourceId, sourceId)))
            .all()
            .find(
              (other) =>
                other.urlKey === fields.urlKey ||
                (other.firstSeenAt >= recent &&
                  other.company.toLowerCase() === job.company.toLowerCase() &&
                  other.title.toLowerCase() === job.title.toLowerCase() &&
                  (other.location ?? '').toLowerCase() === (job.location ?? '').toLowerCase()),
            );
          if (twin) {
            duplicates += 1;
            continue;
          }
          tx.insert(jobs)
            .values({
              id: ulid(),
              sourceId,
              externalId: job.externalId,
              ...fields,
              firstSeenAt: nowIso,
              userState: 'new',
              dismissReason: null,
            })
            .run();
          added += 1;
        }
      });
      return { added, updated, duplicates };
    },

    /** After a successful fetch, jobs that source no longer lists for a few days are marked closed. */
    closeStale(sourceId: string): number {
      const cutoff = new Date(clock().getTime() - CLOSED_AFTER_DAYS * DAY).toISOString();
      return orm
        .update(jobs)
        .set({ state: 'closed' })
        .where(
          and(eq(jobs.sourceId, sourceId), eq(jobs.state, 'active'), lt(jobs.lastSeenAt, cutoff)),
        )
        .run().changes;
    },

    setJobState(id: string, state: JobState, reason?: string): void {
      const result = orm
        .update(jobs)
        .set({ userState: state, dismissReason: state === 'dismissed' ? (reason ?? null) : null })
        .where(eq(jobs.id, id))
        .run();
      if (result.changes === 0) throw new Error('That job no longer exists.');
    },

    /** The reasons you gave for dismissing jobs, newest first, so the scorer can learn what you don't want. */
    recentDismissReasons(limit = 20): string[] {
      const rows = orm
        .select({ reason: jobs.dismissReason })
        .from(jobs)
        .where(eq(jobs.userState, 'dismissed'))
        .orderBy(desc(jobs.lastSeenAt))
        .all();
      return [...new Set(rows.flatMap((row) => (row.reason ? [row.reason] : [])))].slice(0, limit);
    },

    /** Open jobs that pass `search`'s filters and have no up-to-date score, newest first. */
    scoringCandidates(
      search: Search,
      profileVersion: number,
      promptVersion: string,
      limit: number,
    ): { id: string; row: JobRow }[] {
      const now = clock();
      const scored = new Map(
        orm
          .select()
          .from(matches)
          .where(eq(matches.searchId, search.id))
          .all()
          .map((m) => [m.jobId, m]),
      );
      return orm
        .select()
        .from(jobs)
        .where(and(eq(jobs.state, 'active'), ne(jobs.userState, 'dismissed')))
        .orderBy(desc(jobs.firstSeenAt))
        .all()
        .filter((row) => {
          const m = scored.get(row.id);
          const fresh =
            m &&
            m.profileVersion === profileVersion &&
            m.promptVersion === promptVersion &&
            m.contentHash === row.contentHash;
          return !fresh && rejectReason(filterable(row), search, now) === null;
        })
        .slice(0, limit)
        .map((row) => ({ id: row.id, row }));
    },

    countFilteredOut(): number {
      const now = clock();
      const active = enabledSearches();
      if (active.length === 0) return 0;
      return orm
        .select()
        .from(jobs)
        .where(eq(jobs.state, 'active'))
        .all()
        .filter((row) => active.every((s) => rejectReason(filterable(row), s, now) !== null))
        .length;
    },

    saveMatch(
      jobId: string,
      searchId: string,
      profileVersion: number,
      promptVersion: string,
      hash: string,
      result: ScoreResult,
    ): void {
      const values = {
        profileVersion,
        promptVersion,
        contentHash: hash,
        score: result.score,
        result: JSON.stringify(result),
        createdAt: stamp(),
      };
      orm
        .insert(matches)
        .values({ id: ulid(), jobId, searchId, ...values })
        .onConflictDoUpdate({ target: [matches.jobId, matches.searchId], set: values })
        .run();
    },

    /** The feed: open jobs that pass at least one enabled search (or were scored or shortlisted), best score first. */
    listJobs(filter: JobFilter): FeedItem[] {
      const now = clock();
      const active = enabledSearches();
      const sourceLabels = new Map(
        orm
          .select()
          .from(sources)
          .all()
          .map((s) => [s.id, s.label]),
      );
      const best = new Map<string, { score: number; result: ScoreResult }>();
      for (const m of orm.select().from(matches).all()) {
        const current = best.get(m.jobId);
        if (!current || m.score > current.score)
          best.set(m.jobId, { score: m.score, result: scoreResultSchema.parse(json(m.result)) });
      }

      const wanted: string[] =
        filter.state === undefined || filter.state === 'open'
          ? ['new', 'shortlisted']
          : [filter.state];
      const text = filter.text?.trim().toLowerCase();
      const recent = now.getTime() - DAY;

      return orm
        .select()
        .from(jobs)
        .where(
          and(
            eq(jobs.state, 'active'),
            inArray(jobs.userState, wanted),
            filter.sourceId ? eq(jobs.sourceId, filter.sourceId) : undefined,
          ),
        )
        .all()
        .filter((row) => {
          const match = best.get(row.id);
          if (
            !match &&
            row.userState === 'new' &&
            active.length > 0 &&
            active.every((s) => rejectReason(filterable(row), s, now) !== null)
          )
            return false;
          if (text && !`${row.company} ${row.title}`.toLowerCase().includes(text)) return false;
          if (filter.minScore !== undefined && (match?.score ?? -1) < filter.minScore) return false;
          return true;
        })
        .map<FeedItem>((row) => {
          const match = best.get(row.id);
          return {
            id: row.id,
            company: row.company,
            title: row.title,
            location: row.location,
            remoteMode: row.remoteMode as FeedItem['remoteMode'],
            sourceLabel: sourceLabels.get(row.sourceId) ?? 'Unknown source',
            url: row.url,
            postedAt: row.postedAt,
            firstSeenAt: row.firstSeenAt,
            userState: row.userState as JobState,
            score: match?.score ?? null,
            verdict: match?.result.verdict ?? null,
            summary: match?.result.summary ?? null,
            isNew: row.userState === 'new' && Date.parse(row.firstSeenAt) >= recent,
            injectionWarning: row.injectionFlag,
          };
        })
        .sort(
          (a, b) => (b.score ?? -1) - (a.score ?? -1) || b.firstSeenAt.localeCompare(a.firstSeenAt),
        );
    },

    getJob(id: string): JobDetail | null {
      const row = orm.select().from(jobs).where(eq(jobs.id, id)).get();
      if (!row) return null;
      const names = new Map(
        orm
          .select()
          .from(searches)
          .all()
          .map((s) => [s.id, s.name]),
      );
      const rows = orm.select().from(matches).where(eq(matches.jobId, id)).all();
      const parsed = rows.map((m) => ({
        searchName: names.get(m.searchId) ?? 'A deleted search',
        result: scoreResultSchema.parse(json(m.result)),
      }));
      const top = [...parsed].sort((a, b) => b.result.score - a.result.score)[0];
      const label =
        orm.select().from(sources).where(eq(sources.id, row.sourceId)).get()?.label ??
        'Unknown source';
      return {
        id: row.id,
        company: row.company,
        title: row.title,
        location: row.location,
        remoteMode: row.remoteMode as JobDetail['remoteMode'],
        sourceLabel: label,
        url: row.url,
        postedAt: row.postedAt,
        firstSeenAt: row.firstSeenAt,
        userState: row.userState as JobState,
        score: top?.result.score ?? null,
        verdict: top?.result.verdict ?? null,
        summary: top?.result.summary ?? null,
        isNew: false,
        injectionWarning: row.injectionFlag,
        description: row.description,
        salary: salaryText(row),
        dismissReason: row.dismissReason,
        matches: parsed,
      };
    },

    // Runs
    startRun(trigger: 'launch' | 'timer' | 'manual'): string {
      const id = ulid();
      const empty: RunStats = {
        sources: [],
        filteredOut: 0,
        scored: 0,
        scoreFailures: 0,
        scoringNote: null,
      };
      orm
        .insert(runs)
        .values({
          id,
          trigger,
          startedAt: stamp(),
          finishedAt: null,
          state: 'running',
          stats: JSON.stringify(empty),
        })
        .run();
      return id;
    },

    finishRun(
      id: string,
      state: 'done' | 'partial' | 'failed' | 'stopped_cap',
      stats: RunStats,
    ): void {
      orm
        .update(runs)
        .set({ finishedAt: stamp(), state, stats: JSON.stringify(stats) })
        .where(eq(runs.id, id))
        .run();
    },

    lastRun() {
      const row = orm.select().from(runs).orderBy(desc(runs.startedAt)).get();
      if (!row) return null;
      return {
        id: row.id,
        trigger: row.trigger as 'launch' | 'timer' | 'manual',
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
        state: row.state as 'running' | 'done' | 'partial' | 'failed' | 'stopped_cap',
        stats: json<RunStats>(row.stats),
      };
    },
  };
}

export type DiscoveryRepo = ReturnType<typeof createDiscoveryRepo>;
