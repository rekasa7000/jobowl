import type OpenAI from 'openai';
import type { ModelInfo, ProviderId } from '@shared/schemas/ai';
import {
  InvalidOutputError,
  jsonSchemaOf,
  RefusedError,
  TruncatedError,
  type GenerateRequest,
  type GenerateResult,
  type LlmProvider,
  type Usage,
} from '../provider';

/** Serves OpenAI itself and any OpenAI-compatible server (LM Studio, llama.cpp, OpenRouter, ...). */
export function createOpenAiProvider(
  client: OpenAI,
  id: Extract<ProviderId, 'openai' | 'openai_compatible'> = 'openai',
): LlmProvider {
  return {
    id,

    async listModels(): Promise<ModelInfo[]> {
      const models: ModelInfo[] = [];
      for await (const model of client.models.list())
        models.push({ id: model.id, label: model.id });
      return models.sort((a, b) => a.id.localeCompare(b.id));
    },

    async generateObject<T>(request: GenerateRequest<T>): Promise<GenerateResult<T>> {
      const user = request.context ? `${request.context}\n\n${request.input}` : request.input;
      const response = await client.chat.completions.create(
        {
          model: request.model,
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: user },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'result', strict: true, schema: jsonSchemaOf(request.schema) },
          },
          max_completion_tokens: request.maxOutputTokens ?? 16_000,
        },
        request.signal ? { signal: request.signal } : undefined,
      );

      const cached = response.usage?.prompt_tokens_details?.cached_tokens ?? 0;
      const usage: Usage = {
        inputTokens: Math.max(0, (response.usage?.prompt_tokens ?? 0) - cached),
        outputTokens: response.usage?.completion_tokens ?? 0,
        cachedInputTokens: cached,
        cacheWriteTokens: 0,
      };

      const choice = response.choices[0];
      if (!choice) throw new InvalidOutputError('The server returned no answer.', usage);
      if (choice.message.refusal) throw new RefusedError(usage);
      if (choice.finish_reason === 'length') throw new TruncatedError(usage);

      let parsed: unknown;
      try {
        parsed = JSON.parse(choice.message.content ?? '');
      } catch {
        throw new InvalidOutputError('It was not valid JSON.', usage);
      }
      const checked = request.schema.safeParse(parsed);
      if (!checked.success) {
        throw new InvalidOutputError(checked.error.issues[0]?.message ?? '', usage);
      }
      return { value: checked.data, usage };
    },
  };
}
