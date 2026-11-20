import { gte, sql } from 'drizzle-orm';
import type { Spend } from '@shared/schemas/ai';
import { ulid } from '../ids';
import type { Db } from './open';
import { aiCalls } from './schema';

export type CallOutcome = 'ok' | 'invalid_output' | 'refused' | 'truncated' | 'error';

export interface CallRecord {
  layer: string;
  provider: string;
  model: string;
  promptVersion: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  costUsd: number | null;
  durationMs: number;
  outcome: CallOutcome;
}

function startOfMonth(now: Date): string {
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export function createAiCallsRepo(db: Db, clock: () => Date = () => new Date()) {
  const { orm } = db;
  return {
    record(call: CallRecord): void {
      orm
        .insert(aiCalls)
        .values({ id: ulid(), ...call, createdAt: clock().toISOString() })
        .run();
    },

    /** Spend since the first of this month, local time. Calls with no known price are counted, not costed. */
    spendThisMonth(): Spend {
      const rows = orm
        .select({
          layer: aiCalls.layer,
          calls: sql<number>`count(*)`,
          usd: sql<number>`coalesce(sum(${aiCalls.costUsd}), 0)`,
          unpriced: sql<number>`sum(case when ${aiCalls.costUsd} is null then 1 else 0 end)`,
        })
        .from(aiCalls)
        .where(gte(aiCalls.createdAt, startOfMonth(clock())))
        .groupBy(aiCalls.layer)
        .all();
      return {
        monthUsd: rows.reduce((total, row) => total + row.usd, 0),
        calls: rows.reduce((total, row) => total + row.calls, 0),
        unpriced: rows.reduce((total, row) => total + row.unpriced, 0),
        byLayer: rows.map(({ layer, calls, usd }) => ({ layer, calls, usd })),
      };
    },
  };
}

export type AiCallsRepo = ReturnType<typeof createAiCallsRepo>;
