import type { Ollama } from 'ollama';
import type { ModelInfo } from '@shared/schemas/ai';
import {
  InvalidOutputError,
  jsonSchemaOf,
  TruncatedError,
  type GenerateRequest,
  type GenerateResult,
  type LlmProvider,
  type Usage,
} from '../provider';

/** A model running on this PC. Nothing leaves the machine. */
export function createOllamaProvider(client: Ollama): LlmProvider {
  return {
    id: 'ollama',

    async listModels(): Promise<ModelInfo[]> {
      const { models } = await client.list();
      return models.map((model) => ({ id: model.name, label: model.name }));
    },

    async generateObject<T>(request: GenerateRequest<T>): Promise<GenerateResult<T>> {
      const user = request.context ? `${request.context}\n\n${request.input}` : request.input;
      const response = await client.chat({
        model: request.model,
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: user },
        ],
        format: jsonSchemaOf(request.schema),
        stream: false,
        // Keep the model loaded between calls in a run, then let it go.
        keep_alive: '10m',
        options: { num_predict: request.maxOutputTokens ?? 8000, temperature: 0 },
      });

      const usage: Usage = {
        inputTokens: response.prompt_eval_count,
        outputTokens: response.eval_count,
        cachedInputTokens: 0,
        cacheWriteTokens: 0,
      };
      if (response.done_reason === 'length') throw new TruncatedError(usage);

      let parsed: unknown;
      try {
        parsed = JSON.parse(response.message.content);
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
