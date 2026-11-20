import type Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { ModelInfo } from '@shared/schemas/ai';
import {
  InvalidOutputError,
  RefusedError,
  TruncatedError,
  type GenerateRequest,
  type GenerateResult,
  type LlmProvider,
  type Usage,
} from '../provider';

/**
 * Structured output through the SDK's zod helper. The profile (`context`) carries a cache
 * breakpoint, so a run that sends it many times pays for it once. Thinking is left at the
 * model's default (adaptive); only effort is set, and only when the layer asks for it.
 */
export function createAnthropicProvider(client: Anthropic): LlmProvider {
  return {
    id: 'anthropic',

    async listModels(): Promise<ModelInfo[]> {
      const models: ModelInfo[] = [];
      for await (const model of client.models.list()) {
        models.push({ id: model.id, label: model.display_name });
      }
      return models;
    },

    async generateObject<T>(request: GenerateRequest<T>): Promise<GenerateResult<T>> {
      const content = [
        ...(request.context
          ? [
              {
                type: 'text' as const,
                text: request.context,
                cache_control: { type: 'ephemeral' as const },
              },
            ]
          : []),
        { type: 'text' as const, text: request.input },
      ];

      const response = await client.messages.parse(
        {
          model: request.model,
          max_tokens: request.maxOutputTokens ?? 16_000,
          system: request.system,
          messages: [{ role: 'user', content }],
          output_config: {
            // The helper's generic bound is narrower than a layer's generic schema; the answer
            // is re-validated against `request.schema` below, so nothing unchecked gets through.
            format: zodOutputFormat(request.schema as never),
            ...(request.effort ? { effort: request.effort } : {}),
          },
        },
        request.signal ? { signal: request.signal } : undefined,
      );

      const usage: Usage = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cachedInputTokens: response.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
      };

      // Check why it stopped before trusting the content.
      if (response.stop_reason === 'refusal') throw new RefusedError(usage);
      if (response.stop_reason === 'max_tokens') throw new TruncatedError(usage);

      const checked = request.schema.safeParse(response.parsed_output);
      if (!checked.success) {
        throw new InvalidOutputError(checked.error.issues[0]?.message ?? '', usage);
      }
      return { value: checked.data, usage };
    },
  };
}
