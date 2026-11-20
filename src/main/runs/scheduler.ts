import type { Orchestrator } from './orchestrator';

export interface SchedulerDeps {
  now?: () => Date;
  /** How often to check whether a run is due. */
  checkEveryMs?: number;
  /** A short wait after launch, so the window is up before work starts. */
  firstCheckMs?: number;
}

/**
 * Starts a run when one is due: shortly after launch if the last run is overdue, then every ten
 * minutes while jobowl is open. A person's own "Run now" goes straight to the orchestrator.
 */
export function startScheduler(orch: Orchestrator, deps: SchedulerDeps = {}): () => void {
  const now = deps.now ?? (() => new Date());
  const check = (trigger: 'launch' | 'timer') => {
    if (orch.isDue(now())) void orch.start(trigger);
  };
  const first = setTimeout(() => check('launch'), deps.firstCheckMs ?? 5000);
  const every = setInterval(() => check('timer'), deps.checkEveryMs ?? 10 * 60_000);
  return () => {
    clearTimeout(first);
    clearInterval(every);
  };
}
