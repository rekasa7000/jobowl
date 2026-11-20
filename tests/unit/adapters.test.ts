import type Anthropic from '@anthropic-ai/sdk';
import type { Ollama } from 'ollama';
import type OpenAI from 'openai';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createAnthropicProvider } from '../../src/main/ai/adapters/anthropic';
import { createOllamaProvider } from '../../src/main/ai/adapters/ollama';
import { createOpenAiProvider } from '../../src/main/ai/adapters/openai';
import {
  InvalidOutputError,
  RefusedError,
  TruncatedError,
  type GenerateRequest,
} from '../../src/main/ai/provider';

const schema = z.object({ name: z.string(), years: z.number() });
const request: GenerateRequest<z.infer<typeof schema>> = {
  model: 'test-model',
  system: 'Be exact.',
  context: 'PROFILE TEXT',
  input: 'THIS RESUME',
  schema,
};

type Params = Record<string, unknown>;

function anthropicWith(response: Record<string, unknown>, seen: Params[] = []) {
  const client = {
    messages: {
      parse: (params: Params) => {
        seen.push(params);
        return Promise.resolve(response);
      },
    },
    models: {
      list: async function* () {
        await Promise.resolve();
        yield { id: 'claude-opus-5-5', display_name: 'Claude Opus 5.5' };
      },
    },
  };
  return createAnthropicProvider(client as unknown as Anthropic);
}

const anthropicUsage = {
  input_tokens: 100,
  output_tokens: 40,
  cache_read_input_tokens: 900,
  cache_creation_input_tokens: 0,
};

describe('anthropic adapter', () => {
  it('puts the stable context first with a cache breakpoint and the volatile input last', async () => {
    const seen: Params[] = [];
    const provider = anthropicWith(
      { stop_reason: 'end_turn', parsed_output: { name: 'Ada', years: 3 }, usage: anthropicUsage },
      seen,
    );
    await provider.generateObject({ ...request, effort: 'low' });

    const sent = seen[0] as {
      system: string;
      messages: { content: Params[] }[];
      output_config: Params;
    };
    expect(sent.system).toBe('Be exact.');
    const [context, input] = sent.messages[0]?.content ?? [];
    expect(context).toMatchObject({ text: 'PROFILE TEXT', cache_control: { type: 'ephemeral' } });
    expect(input).toEqual({ type: 'text', text: 'THIS RESUME' });
    expect(sent.output_config).toMatchObject({ effort: 'low' });
  });

  it('sends no effort unless asked, and never a thinking setting', async () => {
    const seen: Params[] = [];
    const provider = anthropicWith(
      { stop_reason: 'end_turn', parsed_output: { name: 'Ada', years: 3 }, usage: anthropicUsage },
      seen,
    );
    await provider.generateObject(request);
    expect(seen[0]?.['output_config']).not.toHaveProperty('effort');
    expect(seen[0]).not.toHaveProperty('thinking');
  });

  it('returns the value and maps usage including cache reads', async () => {
    const provider = anthropicWith({
      stop_reason: 'end_turn',
      parsed_output: { name: 'Ada', years: 3 },
      usage: anthropicUsage,
    });
    const result = await provider.generateObject(request);
    expect(result.value).toEqual({ name: 'Ada', years: 3 });
    expect(result.usage).toEqual({
      inputTokens: 100,
      outputTokens: 40,
      cachedInputTokens: 900,
      cacheWriteTokens: 0,
    });
  });

  it('turns a refusal into RefusedError and keeps the usage', async () => {
    const provider = anthropicWith({
      stop_reason: 'refusal',
      parsed_output: null,
      usage: anthropicUsage,
    });
    await expect(provider.generateObject(request)).rejects.toMatchObject({
      constructor: RefusedError,
      usage: { outputTokens: 40 },
    });
  });

  it('turns running out of tokens into TruncatedError', async () => {
    const provider = anthropicWith({
      stop_reason: 'max_tokens',
      parsed_output: null,
      usage: anthropicUsage,
    });
    await expect(provider.generateObject(request)).rejects.toBeInstanceOf(TruncatedError);
  });

  it('rejects an answer that does not match the schema', async () => {
    const provider = anthropicWith({
      stop_reason: 'end_turn',
      parsed_output: { name: 'Ada', years: 'three' },
      usage: anthropicUsage,
    });
    await expect(provider.generateObject(request)).rejects.toBeInstanceOf(InvalidOutputError);
  });

  it('lists models by id and display name', async () => {
    const provider = anthropicWith({});
    expect(await provider.listModels()).toEqual([
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
    ]);
  });
});

function openAiWith(
  choice: Record<string, unknown> | undefined,
  usage: Record<string, unknown>,
  seen: Params[] = [],
) {
  const client = {
    chat: {
      completions: {
        create: (params: Params) => {
          seen.push(params);
          return Promise.resolve({ choices: choice ? [choice] : [], usage });
        },
      },
    },
    models: {
      list: async function* () {
        await Promise.resolve();
        yield { id: 'zeta' };
        yield { id: 'alpha' };
      },
    },
  };
  return createOpenAiProvider(client as unknown as OpenAI, 'openai_compatible');
}

describe('openai adapter', () => {
  it('asks for strict JSON in the schema and sends context ahead of the input', async () => {
    const seen: Params[] = [];
    const provider = openAiWith(
      { message: { content: '{"name":"Ada","years":3}' }, finish_reason: 'stop' },
      { prompt_tokens: 1000, completion_tokens: 20, prompt_tokens_details: { cached_tokens: 800 } },
      seen,
    );
    const result = await provider.generateObject(request);

    const sent = seen[0] as {
      response_format: { json_schema: { strict: boolean; schema: Params } };
      messages: { content: string }[];
    };
    expect(sent.response_format.json_schema.strict).toBe(true);
    expect(sent.response_format.json_schema.schema).toMatchObject({
      type: 'object',
      required: ['name', 'years'],
    });
    expect(sent.response_format.json_schema.schema).not.toHaveProperty('$schema');
    expect(sent.messages[1]?.content).toBe('PROFILE TEXT\n\nTHIS RESUME');
    expect(result.usage).toMatchObject({
      inputTokens: 200,
      cachedInputTokens: 800,
      outputTokens: 20,
    });
  });

  it.each([
    [
      'a refusal',
      { message: { content: null, refusal: 'no' }, finish_reason: 'stop' },
      RefusedError,
    ],
    ['a cut-off answer', { message: { content: '{' }, finish_reason: 'length' }, TruncatedError],
    [
      'text that is not JSON',
      { message: { content: 'sure!' }, finish_reason: 'stop' },
      InvalidOutputError,
    ],
    [
      'JSON of the wrong shape',
      { message: { content: '{"name":1}' }, finish_reason: 'stop' },
      InvalidOutputError,
    ],
  ])('rejects %s', async (_label, choice, expected) => {
    const provider = openAiWith(choice, { prompt_tokens: 10, completion_tokens: 5 });
    await expect(provider.generateObject(request)).rejects.toBeInstanceOf(expected);
  });

  it('rejects an empty answer list', async () => {
    const provider = openAiWith(undefined, {});
    await expect(provider.generateObject(request)).rejects.toBeInstanceOf(InvalidOutputError);
  });

  it('lists models in alphabetical order', async () => {
    const provider = openAiWith(undefined, {});
    expect((await provider.listModels()).map((m) => m.id)).toEqual(['alpha', 'zeta']);
  });
});

function ollamaWith(response: Record<string, unknown>, seen: Params[] = []) {
  const client = {
    chat: (params: Params) => {
      seen.push(params);
      return Promise.resolve(response);
    },
    list: () => Promise.resolve({ models: [{ name: 'llama3.1:8b' }] }),
  };
  return createOllamaProvider(client as unknown as Ollama);
}

describe('ollama adapter', () => {
  it('passes the schema as the format and reports token counts', async () => {
    const seen: Params[] = [];
    const provider = ollamaWith(
      {
        message: { content: '{"name":"Ada","years":3}' },
        done_reason: 'stop',
        prompt_eval_count: 300,
        eval_count: 30,
      },
      seen,
    );
    const result = await provider.generateObject(request);
    expect(seen[0]?.['format']).toMatchObject({ type: 'object', required: ['name', 'years'] });
    expect(seen[0]?.['stream']).toBe(false);
    expect(result.usage).toMatchObject({
      inputTokens: 300,
      outputTokens: 30,
      cachedInputTokens: 0,
    });
  });

  it('flags a cut-off answer and an invalid one', async () => {
    await expect(
      ollamaWith({
        message: { content: '{' },
        done_reason: 'length',
        prompt_eval_count: 1,
        eval_count: 1,
      }).generateObject(request),
    ).rejects.toBeInstanceOf(TruncatedError);
    await expect(
      ollamaWith({
        message: { content: 'nope' },
        done_reason: 'stop',
        prompt_eval_count: 1,
        eval_count: 1,
      }).generateObject(request),
    ).rejects.toBeInstanceOf(InvalidOutputError);
  });

  it('lists installed models', async () => {
    expect(await ollamaWith({}).listModels()).toEqual([
      { id: 'llama3.1:8b', label: 'llama3.1:8b' },
    ]);
  });
});
