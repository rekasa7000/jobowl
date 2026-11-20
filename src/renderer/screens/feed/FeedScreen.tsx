import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import type { JobFilter, RunStatus } from '@shared/schemas/discovery';
import { ScoreMark } from '../../components/ScoreMark';
import { ScreenHeader } from '../../components/ScreenHeader';
import {
  useJobs,
  useRunStatus,
  useSearches,
  useSetJobState,
  useSources,
  useStartRun,
} from '../../lib/discovery';

export interface FeedContext {
  onDismissed: (job: { id: string; title: string }) => void;
}

type View = 'open' | 'shortlisted' | 'dismissed';
const VIEWS: { id: View; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'shortlisted', label: 'Shortlisted' },
  { id: 'dismissed', label: 'Dismissed' },
];

function ago(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${String(minutes)} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${String(hours)} h ago` : `${String(Math.round(hours / 24))} d ago`;
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

function RunPanel({ status }: { status: RunStatus | undefined }) {
  if (!status) return null;
  const last = status.last;
  const failed = last?.stats.sources.filter((s) => s.status !== 'ok') ?? [];
  const added = last?.stats.sources.reduce((total, s) => total + s.added, 0) ?? 0;
  return (
    <section aria-label="Run status" className="readout mx-4 mt-4 px-4 py-3 text-[0.8125rem]">
      {status.running ? (
        <p role="status" className="flex items-center gap-2">
          <span className="blink text-signal" aria-hidden="true">
            ●
          </span>
          <span className="font-mono">{status.message || 'Starting…'}</span>
        </p>
      ) : last ? (
        <>
          <p role="status" className="font-mono text-ink-2">
            Last run {ago(last.finishedAt ?? last.startedAt)} · {added} new · {last.stats.scored}{' '}
            scored
            {last.stats.filteredOut > 0 ? ` · ${String(last.stats.filteredOut)} ruled out` : ''}
          </p>
          {last.state === 'stopped_cap' && (
            <p className="mt-1 text-danger">Stopped at your monthly AI limit.</p>
          )}
          {last.stats.scoringNote && <p className="mt-1 text-ink-2">{last.stats.scoringNote}</p>}
          {failed.map((source) => (
            <p key={source.label} className="mt-1 text-danger">
              {source.label}: {source.error ?? 'failed'}
            </p>
          ))}
        </>
      ) : (
        <p className="text-ink-2">No run yet. Run now fetches your sources and scores what fits.</p>
      )}
    </section>
  );
}

export function FeedScreen() {
  const searchRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [view, setView] = useState<View>('open');
  const [minScore, setMinScore] = useState<'any' | '50' | '75'>('any');
  const [undo, setUndo] = useState<{ id: string; title: string } | null>(null);

  const run = useRunStatus();
  const start = useStartRun();
  const setState = useSetJobState();
  const sources = useSources();
  const searches = useSearches();
  const filter: JobFilter = {
    state: view,
    ...(text.trim() ? { text } : {}),
    ...(minScore !== 'any' ? { minScore: Number(minScore) } : {}),
  };
  const jobs = useJobs(filter, run.data?.running ?? false);
  const running = run.data?.running ?? false;

  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), 8000);
    return () => clearTimeout(timer);
  }, [undo]);

  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      if (event.key === '/') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function onListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const rows = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>('a'));
    const index = rows.findIndex((row) => row === document.activeElement);
    const next = rows[index + (event.key === 'ArrowDown' ? 1 : -1)];
    if (index === -1 || !next) return;
    event.preventDefault();
    next.focus();
    next.click();
  }

  const list = jobs.data ?? [];
  const needsSetup = (sources.data?.length ?? 0) === 0 || (searches.data?.length ?? 0) === 0;
  const context: FeedContext = { onDismissed: setUndo };

  return (
    <>
      <ScreenHeader
        title="Feed"
        aside={
          list.length === 0
            ? 'nothing to read yet'
            : `${String(list.length)} ${list.length === 1 ? 'job' : 'jobs'}`
        }
        actions={
          <button
            type="button"
            className="btn-ink"
            disabled={running || start.isPending || needsSetup}
            onClick={() => start.mutate()}
          >
            {running ? 'Running…' : 'Run now'}
          </button>
        }
      />
      <div className="flex min-h-0 flex-1">
        <section
          aria-label="Job list"
          className="flex w-[45%] min-w-[360px] flex-col border-r-[1.5px] border-line"
        >
          <RunPanel status={run.data} />
          {undo && (
            <p
              role="status"
              className="mx-4 mt-3 flex items-center justify-between gap-3 text-[0.8125rem]"
            >
              <span className="truncate">Dismissed {undo.title}.</span>
              <button
                type="button"
                className="btn-quiet"
                onClick={() => {
                  setState.mutate({ id: undo.id, state: 'new' });
                  setUndo(null);
                }}
              >
                Undo
              </button>
            </p>
          )}
          <div className="flex flex-col gap-3 border-b border-line p-4">
            <input
              ref={searchRef}
              type="search"
              className="input"
              aria-label="Search jobs"
              placeholder="Search company or title  ( / )"
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => event.key === 'Escape' && event.currentTarget.blur()}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div role="radiogroup" aria-label="Show" className="flex gap-2">
                {VIEWS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={view === option.id}
                    className="chip"
                    onClick={() => setView(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-[0.8125rem]">
                Score
                <select
                  className="input !min-h-0 !w-auto !py-1"
                  value={minScore}
                  onChange={(event) => setMinScore(event.target.value as typeof minScore)}
                >
                  <option value="any">Any</option>
                  <option value="50">50 and up</option>
                  <option value="75">75 and up</option>
                </select>
              </label>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-2">
            {jobs.isError ? (
              <p role="alert" className="p-4 text-danger">
                Couldn't load jobs. Restart jobowl; if this keeps happening, check the log folder in
                your data directory.
              </p>
            ) : list.length > 0 ? (
              <ul aria-label="Jobs" onKeyDown={onListKeyDown}>
                {list.map((job) => (
                  <li key={job.id}>
                    <NavLink to={`/feed/${job.id}`} className="row-link">
                      <span className="flex items-start gap-4">
                        <span className="w-16 shrink-0">
                          <ScoreMark score={job.score} verdict={job.verdict} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            {job.isNew && (
                              <span
                                aria-label="New"
                                className="h-2 w-2 shrink-0 rounded-full bg-accent"
                              />
                            )}
                            <span className="block truncate font-semibold">{job.title}</span>
                          </span>
                          <span className="block truncate text-[0.8125rem] text-ink-2">
                            {job.company}
                            {job.location ? ` · ${job.location}` : ''}
                            {job.remoteMode !== 'unknown' ? ` · ${job.remoteMode}` : ''}
                          </span>
                          <span className="mt-1 flex items-center gap-2 font-mono text-[0.6875rem] text-ink-3">
                            <span>{job.sourceLabel}</span>
                            <span>{ago(job.postedAt ?? job.firstSeenAt)}</span>
                            {job.injectionWarning && (
                              <span className="text-danger">check the posting</span>
                            )}
                          </span>
                        </span>
                      </span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            ) : needsSetup ? (
              <div className="p-6">
                <h2 className="font-display-caps text-[1.5rem]">Set up what to look for</h2>
                <p className="mt-2 text-ink-2">
                  jobowl needs at least one search and one source before it can find anything.
                </p>
                <div className="mt-4 flex gap-3">
                  <Link to="/searches" className="btn-ink">
                    Add a search
                  </Link>
                  <Link to="/sources" className="btn-ghost">
                    Add a source
                  </Link>
                </div>
              </div>
            ) : text || minScore !== 'any' || view !== 'open' ? (
              <div className="p-6">
                <h2 className="font-display-caps text-[1.5rem]">Nothing matches these filters</h2>
              </div>
            ) : (
              <div className="p-6">
                <h2 className="font-display-caps text-[1.5rem]">No jobs yet</h2>
                <p className="mt-2 text-ink-2">
                  Run now to fetch your sources. Runs also start by themselves.
                </p>
              </div>
            )}
          </div>
        </section>
        <main className="min-w-0 flex-1 overflow-auto">
          <Outlet context={context} />
        </main>
      </div>
    </>
  );
}
