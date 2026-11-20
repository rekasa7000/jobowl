import { z } from 'zod';
import type { LayerChoice, TestResult } from '@shared/schemas/ai';
import type { AiCallsRepo } from '../db/ai-calls-repo';
import { estimateCostUsd } from './pricing';
import { ModelError, type LlmProvider } from './provider';

const pong = z.object({ ok: z.boolean() });

/** Sends one tiny request so the user can see a provider, key and model work before relying on them. */
export async function testModel(
  makeProvider: () => Promise<LlmProvider>,
  choice: LayerChoice,
  calls: AiCallsRepo,
): Promise<TestResult> {
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  try {
    const provider = await makeProvider();
    const result = await provider.generateObject({
      model: choice.model,
      system: 'Answer with JSON only.',
      input: 'Reply with {"ok": true}.',
      schema: pong,
      maxOutputTokens: 200,
    });
    calls.record({
      layer: 'test',
      provider: choice.provider,
      model: choice.model,
      promptVersion: 'test@1',
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      cachedInputTokens: result.usage.cachedInputTokens,
      costUsd: estimateCostUsd(choice.provider, choice.model, result.usage),
      durationMs: elapsed(),
      outcome: 'ok',
    });
    return { ok: result.value.ok, ms: elapsed() };
  } catch (error) {
    const usage = error instanceof ModelError ? error.usage : undefined;
    if (usage) {
      calls.record({
        layer: 'test',
        provider: choice.provider,
        model: choice.model,
        promptVersion: 'test@1',
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cachedInputTokens: usage.cachedInputTokens,
        costUsd: estimateCostUsd(choice.provider, choice.model, usage),
        durationMs: elapsed(),
        outcome: 'error',
      });
    }
    return {
      ok: false,
      ms: elapsed(),
      error: error instanceof Error ? error.message : 'The request failed.',
    };
  }
}
