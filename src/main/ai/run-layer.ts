import type { AiSettings, Layer } from '@shared/schemas/ai';
import { LAYER_LABELS } from '@shared/schemas/ai';
import type { AiCallsRepo, CallOutcome } from '../db/ai-calls-repo';
import { estimateCostUsd } from './pricing';
import {
  InvalidOutputError,
  ModelError,
  NotConfiguredError,
  RefusedError,
  TruncatedError,
  type GenerateRequest,
  type LlmProvider,
  type Usage,
} from './provider';
import type { ProviderId } from '@shared/schemas/ai';

export interface AiServices {
  getSettings: () => AiSettings;
  providerFor: (id: ProviderId) => LlmProvider;
  calls: AiCallsRepo;
}

const NO_USAGE: Usage = {
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
  cacheWriteTokens: 0,
};

function outcomeOf(error: unknown): CallOutcome {
  if (error instanceof RefusedError) return 'refused';
  if (error instanceof InvalidOutputError) return 'invalid_output';
  if (error instanceof TruncatedError) return 'truncated';
  return 'error';
}

/**
 * Runs one AI layer with the model chosen for it in Settings, and logs the call either way.
 * `build` receives nothing the layer shouldn't decide: the model is picked here, not there.
 */
export async function runLayer<T>(
  ai: AiServices,
  layer: Layer,
  promptVersion: string,
  request: Omit<GenerateRequest<T>, 'model'>,
): Promise<T> {
  const choice = ai.getSettings().layers[layer];
  if (!choice) {
    throw new NotConfiguredError(
      `Choose a model for the ${LAYER_LABELS[layer].name} in Settings before using this.`,
    );
  }
  const provider = ai.providerFor(choice.provider);
  const started = performance.now();
  const record = (usage: Usage, outcome: CallOutcome) =>
    ai.calls.record({
      layer,
      provider: choice.provider,
      model: choice.model,
      promptVersion,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cachedInputTokens: usage.cachedInputTokens,
      costUsd: estimateCostUsd(choice.provider, choice.model, usage),
      durationMs: Math.round(performance.now() - started),
      outcome,
    });

  try {
    const result = await provider.generateObject({ ...request, model: choice.model });
    record(result.usage, 'ok');
    return result.value;
  } catch (error) {
    record(error instanceof ModelError && error.usage ? error.usage : NO_USAGE, outcomeOf(error));
    throw error;
  }
}
