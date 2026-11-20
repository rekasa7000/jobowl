import type { Settings } from '@shared/schemas/settings';
import type { RunStats, RunStatus, Search, Source } from '@shared/schemas/discovery';
import type { Profile } from '@shared/schemas/profile';
import { finishScore, profileDigest, scoreJob, SCORER_VERSION } from '../ai/layers/scorer';
import { NotConfiguredError } from '../ai/provider';
import type { AiServices } from '../ai/run-layer';
import type { AiCallsRepo } from '../db/ai-calls-repo';
import type { DiscoveryRepo } from '../db/discovery-repo';
import type { Connector } from '../sources/connector';
import { SourceError } from '../sources/errors';
import type { Http } from '../sources/http';

const FETCH_PARALLEL = 4;
const MAX_SCORED_PER_RUN = 150;
const STOP_AFTER_FAILURES = 5;

export interface OrchestratorDeps {
  repo: DiscoveryRepo;
  profile: () => { version: number; profile: Profile } | null;
  ai: AiServices;
  calls: AiCallsRepo;
  settings: () => Settings;
  connectors: Record<string, Connector<Record<string, string>>>;
  http: Http;
  secret: (name: string) => Promise<string | null>;
  /** Called after a run with the new strong matches, so the app can tell you. */
  notify?: (matches: { title: string; company: string; score: number }[]) => void;
  maxScoredPerRun?: number;
}

type SourceOutcome = RunStats['sources'][number];

async function pool<T>(items: T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      for (let next = queue.shift(); next !== undefined; next = queue.shift()) await work(next);
    }),
  );
}

/**
 * One pass of discovery: fetch every enabled source, drop what the searches rule out, score what's
 * left. A failing source doesn't fail the run. Scoring stops at the monthly spending cap.
 * Only one run happens at a time; asking for another while one is running joins it.
 */
export function createOrchestrator(deps: OrchestratorDeps) {
  const { repo } = deps;
  let current: Promise<void> | null = null;
  let progress = { phase: 'idle', message: '' };

  async function fetchSources(queries: string[]): Promise<SourceOutcome[]> {
    const list = repo.enabledSources();
    const outcomes: SourceOutcome[] = [];
    let done = 0;
    await pool(list, FETCH_PARALLEL, async (source: Source) => {
      progress = {
        phase: 'fetching',
        message: `Fetching sources (${String(done)} of ${String(list.length)} done)`,
      };
      const outcome: SourceOutcome = {
        label: source.label,
        status: 'ok',
        fetched: 0,
        added: 0,
        skipped: 0,
      };
      try {
        const connector = deps.connectors[source.type];
        if (!connector) throw new SourceError(`jobowl has no reader for ${source.type}.`, 'error');
        const config = connector.configSchema.safeParse(source.config);
        if (!config.success)
          throw new SourceError("This source's settings are incomplete.", 'error');
        const result = await connector.fetch(config.data, {
          http: deps.http,
          label: source.label,
          queries,
          secret: deps.secret,
        });
        const stored = repo.upsertJobs(source.id, result.jobs);
        repo.closeStale(source.id);
        Object.assign(outcome, {
          fetched: result.jobs.length,
          added: stored.added,
          skipped: result.skipped,
        });
        repo.recordSourceRun(source.id, 'ok', null);
      } catch (error) {
        outcome.status = error instanceof SourceError ? error.status : 'error';
        outcome.error = error instanceof Error ? error.message : 'Something unexpected went wrong.';
        repo.recordSourceRun(source.id, outcome.status, outcome.error);
      }
      outcomes.push(outcome);
      done += 1;
    });
    return outcomes;
  }

  async function score(
    searches: Search[],
    stats: RunStats,
  ): Promise<{ capped: boolean; strong: { title: string; company: string; score: number }[] }> {
    const strong: { title: string; company: string; score: number }[] = [];
    const saved = deps.profile();
    if (!saved) {
      stats.scoringNote =
        'No profile yet, so jobs are unscored. Import your resume on the Profile screen.';
      return { capped: false, strong };
    }
    if (!deps.settings().ai.layers.scorer) {
      stats.scoringNote = 'Choose a model for the Scorer in Settings to rate jobs.';
      return { capped: false, strong };
    }

    const digest = profileDigest(saved.profile);
    const reasons = repo.recentDismissReasons();
    let remaining = deps.maxScoredPerRun ?? MAX_SCORED_PER_RUN;
    let inARow = 0;

    for (const search of searches) {
      const candidates = repo.scoringCandidates(search, saved.version, SCORER_VERSION, remaining);
      for (const { id, row } of candidates) {
        const cap = deps.settings().ai.monthlyCapUsd;
        if (cap > 0 && deps.calls.spendThisMonth().monthUsd >= cap) {
          stats.scoringNote = `Stopped at your monthly AI limit of $${cap.toFixed(2)}. Raise it in Settings to keep scoring.`;
          return { capped: true, strong };
        }
        progress = {
          phase: 'scoring',
          message: `Scoring ${String(stats.scored + 1)}: ${row.title}`,
        };
        try {
          const raw = await scoreJob(
            deps.ai,
            digest,
            {
              company: row.company,
              title: row.title,
              location: row.location,
              remoteMode: row.remoteMode,
              salary: null,
              description: row.description,
            },
            search,
            reasons,
          );
          const result = finishScore(raw, digest.ids);
          repo.saveMatch(id, search.id, saved.version, SCORER_VERSION, row.contentHash, result);
          stats.scored += 1;
          remaining -= 1;
          inARow = 0;
          if (result.score >= search.minScoreNotify)
            strong.push({ title: row.title, company: row.company, score: result.score });
        } catch (error) {
          if (error instanceof NotConfiguredError) {
            stats.scoringNote = error.message;
            return { capped: false, strong };
          }
          stats.scoreFailures += 1;
          inARow += 1;
          if (inARow >= STOP_AFTER_FAILURES) {
            const why = error instanceof Error ? error.message : 'unknown error';
            stats.scoringNote = `Stopped after ${String(STOP_AFTER_FAILURES)} failures in a row: ${why}`;
            return { capped: false, strong };
          }
        }
        if (remaining <= 0) {
          stats.scoringNote = `Scored the newest ${String(deps.maxScoredPerRun ?? MAX_SCORED_PER_RUN)} jobs. The rest are scored next run.`;
          return { capped: false, strong };
        }
      }
    }
    return { capped: false, strong };
  }

  async function execute(trigger: 'launch' | 'timer' | 'manual'): Promise<void> {
    const runId = repo.startRun(trigger);
    const stats: RunStats = {
      sources: [],
      filteredOut: 0,
      scored: 0,
      scoreFailures: 0,
      scoringNote: null,
    };
    let state: 'done' | 'partial' | 'failed' | 'stopped_cap' = 'done';
    try {
      const searches = repo.enabledSearches();
      const queries = [...new Set(searches.flatMap((s) => s.titles))];
      stats.sources = await fetchSources(queries);

      progress = { phase: 'filtering', message: 'Applying your searches' };
      stats.filteredOut = repo.countFilteredOut();

      const outcome = await score(searches, stats);
      const failed = stats.sources.filter((s) => s.status !== 'ok').length;
      if (outcome.capped) state = 'stopped_cap';
      else if (stats.sources.length > 0 && failed === stats.sources.length) state = 'failed';
      else if (failed > 0 || stats.scoreFailures > 0) state = 'partial';
      if (outcome.strong.length > 0) deps.notify?.(outcome.strong);
    } catch (error) {
      stats.scoringNote = error instanceof Error ? error.message : 'The run stopped unexpectedly.';
      state = 'failed';
    } finally {
      repo.finishRun(runId, state, stats);
      progress = { phase: 'idle', message: '' };
    }
  }

  return {
    /** Starts a run, or joins the one already going. */
    start(trigger: 'launch' | 'timer' | 'manual'): Promise<void> {
      current ??= execute(trigger).finally(() => {
        current = null;
      });
      return current;
    },

    status(): RunStatus {
      return {
        running: current !== null,
        phase: progress.phase,
        message: progress.message,
        last: repo.lastRun(),
      };
    },

    /** True when a scheduled run is due: sources and searches exist and the last run is old enough. */
    isDue(now: Date): boolean {
      if (current || repo.enabledSources().length === 0 || repo.enabledSearches().length === 0)
        return false;
      const last = repo.lastRun();
      if (!last) return true;
      const hours = deps.settings().runs.intervalHours;
      return now.getTime() - Date.parse(last.startedAt) >= hours * 3_600_000;
    },
  };
}

export type Orchestrator = ReturnType<typeof createOrchestrator>;
