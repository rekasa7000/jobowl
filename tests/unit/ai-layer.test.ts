import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { estimateCostUsd } from '../../src/main/ai/pricing';
import {
  NotConfiguredError,
  RefusedError,
  type GenerateRequest,
  type LlmProvider,
  type Usage,
} from '../../src/main/ai/provider';
import { runLayer, type AiServices } from '../../src/main/ai/run-layer';
import { testModel } from '../../src/main/ai/test-model';
import { createAiCallsRepo, type AiCallsRepo } from '../../src/main/db/ai-calls-repo';
import { openDb, type Db } from '../../src/main/db/open';
import { dataPaths } from '../../src/main/paths';
import { defaultAiSettings, type AiSettings } from '@shared/schemas/ai';

const migrations = join(import.meta.dirname, '../../drizzle');
const usage: Usage = {
  inputTokens: 1000,
  outputTokens: 500,
  cachedInputTokens: 10_000,
  cacheWriteTokens: 0,
};
const schema = z.object({ ok: z.boolean() });

let root: string;
let db: Db;
let calls: AiCallsRepo;
let now: Date;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'jobowl-ai-'));
  db = await openDb(dataPaths(root), migrations);
  now = new Date(2025, 5, 15, 12);
  calls = createAiCallsRepo(db, () => now);
});

afterEach(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});

function services(provider: LlmProvider, ai: Partial<AiSettings> = {}): AiServices {
  return {
    getSettings: () => ({ ...defaultAiSettings, ...ai }),
    providerFor: () => Promise.resolve(provider),
    calls,
  };
}

function fake(result: () => Promise<{ value: { ok: boolean }; usage: Usage }>): LlmProvider {
  return {
    id: 'anthropic',
    listModels: () => Promise.resolve([]),
    generateObject: result as unknown as LlmProvider['generateObject'],
  };
}

const request: Omit<GenerateRequest<{ ok: boolean }>, 'model'> = {
  system: 's',
  input: 'i',
  schema,
};
const parserOnAnthropic = {
  layers: { parser: { provider: 'anthropic' as const, model: 'claude-opus-5-5' } },
};

describe('estimateCostUsd', () => {
  it('prices cached input at a tenth and cache writes at 1.25x', () => {
    // (1000 + 10000 * 0.1) * $4 + 500 * $20 = 8000 + 10000 per million tokens
    expect(estimateCostUsd('anthropic', 'claude-opus-5-5', usage)).toBeCloseTo(0.018, 6);
    expect(
      estimateCostUsd('anthropic', 'claude-opus-5-5', { ...usage, cacheWriteTokens: 1000 }),
    ).toBeCloseTo(0.023, 6);
  });

  it('is free for local models and unknown for models without a listed price', () => {
    expect(estimateCostUsd('ollama', 'llama3.1', usage)).toBe(0);
    expect(estimateCostUsd('openai', 'gpt-whatever', usage)).toBeNull();
    expect(estimateCostUsd('anthropic', 'claude-mystery', usage)).toBeNull();
  });
});

describe('runLayer', () => {
  it('says what to do when no model is chosen for the layer', async () => {
    const ai = services(fake(() => Promise.reject(new Error('should not run'))));
    await expect(runLayer(ai, 'parser', 'parser@1', request)).rejects.toThrow(NotConfiguredError);
    await expect(runLayer(ai, 'parser', 'parser@1', request)).rejects.toThrow(
      /Choose a model for the Parser/,
    );
  });

  it('runs with the chosen model and logs tokens and an estimated cost', async () => {
    let model = '';
    const provider: LlmProvider = {
      id: 'anthropic',
      listModels: () => Promise.resolve([]),
      generateObject: ((req: GenerateRequest<unknown>) => {
        model = req.model;
        return Promise.resolve({ value: { ok: true }, usage });
      }) as LlmProvider['generateObject'],
    };
    const value = await runLayer(
      services(provider, parserOnAnthropic),
      'parser',
      'parser@1',
      request,
    );
    expect(value).toEqual({ ok: true });
    expect(model).toBe('claude-opus-5-5');

    const spend = calls.spendThisMonth();
    expect(spend.calls).toBe(1);
    expect(spend.monthUsd).toBeCloseTo(0.018, 6);
    expect(spend.byLayer).toHaveLength(1);
    expect(spend.byLayer[0]).toMatchObject({ layer: 'parser', calls: 1 });
    expect(spend.byLayer[0]?.usd).toBeCloseTo(0.018, 6);
  });

  it('still logs a failed call, and what it cost when the model had already answered', async () => {
    const provider = fake(() => Promise.reject(new RefusedError(usage)));
    await expect(
      runLayer(services(provider, parserOnAnthropic), 'parser', 'parser@1', request),
    ).rejects.toBeInstanceOf(RefusedError);
    const row = db.sqlite.prepare('select outcome, input_tokens from ai_calls').get();
    expect(row).toEqual({ outcome: 'refused', input_tokens: 1000 });
  });

  it('counts calls to models with no known price separately instead of costing them zero', async () => {
    const provider = fake(() => Promise.resolve({ value: { ok: true }, usage }));
    const ai = services(provider, { layers: { parser: { provider: 'openai', model: 'gpt-x' } } });
    await runLayer(ai, 'parser', 'parser@1', request);
    expect(calls.spendThisMonth()).toMatchObject({ calls: 1, unpriced: 1, monthUsd: 0 });
  });
});

describe('spend', () => {
  it('only counts the current calendar month', async () => {
    const provider = fake(() => Promise.resolve({ value: { ok: true }, usage }));
    now = new Date(2025, 4, 31, 23); // May
    await runLayer(services(provider, parserOnAnthropic), 'parser', 'parser@1', request);
    now = new Date(2025, 5, 2, 9); // June
    await runLayer(services(provider, parserOnAnthropic), 'parser', 'parser@1', request);
    expect(calls.spendThisMonth().calls).toBe(1);
  });
});

describe('testModel', () => {
  const choice = { provider: 'anthropic' as const, model: 'claude-opus-5-5' };

  it('reports success and logs the call under "test"', async () => {
    const provider = fake(() => Promise.resolve({ value: { ok: true }, usage }));
    const result = await testModel(() => Promise.resolve(provider), choice, calls);
    expect(result.ok).toBe(true);
    expect(calls.spendThisMonth().byLayer[0]?.layer).toBe('test');
  });

  it('turns a missing key into a readable failure instead of throwing', async () => {
    const result = await testModel(
      () => Promise.reject(new NotConfiguredError('Add your Anthropic API key in Settings.')),
      choice,
      calls,
    );
    expect(result).toMatchObject({ ok: false, error: 'Add your Anthropic API key in Settings.' });
  });

  it('turns a provider error into a readable failure', async () => {
    const provider = fake(() => Promise.reject(new Error('401 invalid x-api-key')));
    expect(await testModel(() => Promise.resolve(provider), choice, calls)).toMatchObject({
      ok: false,
      error: '401 invalid x-api-key',
    });
  });
});
