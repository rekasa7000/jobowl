import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Orchestrator } from '../../src/main/runs/orchestrator';
import { startScheduler } from '../../src/main/runs/scheduler';

function fake(due: () => boolean) {
  const started: string[] = [];
  const orch = {
    isDue: () => due(),
    start: (trigger: string) => {
      started.push(trigger);
      return Promise.resolve();
    },
  } as unknown as Orchestrator;
  return { orch, started };
}

describe('scheduler', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts an overdue run shortly after launch', () => {
    const { orch, started } = fake(() => true);
    startScheduler(orch, { firstCheckMs: 5000, checkEveryMs: 600_000 });
    vi.advanceTimersByTime(4999);
    expect(started).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(started).toEqual(['launch']);
  });

  it('checks again on a timer and starts a run only when one is due', () => {
    let due = false;
    const { orch, started } = fake(() => due);
    startScheduler(orch, { firstCheckMs: 1000, checkEveryMs: 60_000 });
    vi.advanceTimersByTime(60_000);
    expect(started).toEqual([]);
    due = true;
    vi.advanceTimersByTime(60_000);
    expect(started).toEqual(['timer']);
  });

  it('stops checking once stopped', () => {
    const { orch, started } = fake(() => true);
    const stop = startScheduler(orch, { firstCheckMs: 1000, checkEveryMs: 1000 });
    stop();
    vi.advanceTimersByTime(10_000);
    expect(started).toEqual([]);
  });
});
