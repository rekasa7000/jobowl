import type { ProviderId } from '@shared/schemas/ai';
import type { Usage } from './provider';

/** USD per million tokens. Only models whose price is published and stable are listed. */
const PRICES: Record<string, { input: number; output: number }> = {
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-opus-5': { input: 5, output: 25 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
  'claude-fable-5-2': { input: 8, output: 40 },
};

/**
 * Estimated cost of one call: 0 for models on this PC, null when the price isn't known.
 * Anthropic bills cache reads at a tenth of the input price and cache writes at 1.25x.
 */
export function estimateCostUsd(provider: ProviderId, model: string, usage: Usage): number | null {
  if (provider === 'ollama') return 0;
  const price = provider === 'anthropic' ? PRICES[model] : undefined;
  if (!price) return null;
  const inputUnits =
    usage.inputTokens + usage.cachedInputTokens * 0.1 + usage.cacheWriteTokens * 1.25;
  return (inputUnits * price.input + usage.outputTokens * price.output) / 1_000_000;
}
