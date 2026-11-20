import { z } from 'zod';
import type { ModelInfo, ProviderId } from '@shared/schemas/ai';

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  /** Input tokens served from the provider's prompt cache. */
  cachedInputTokens: number;
  /** Input tokens written to the cache on this call (billed at a premium by Anthropic). */
  cacheWriteTokens: number;
}

export interface GenerateRequest<T> {
  model: string;
  /** Stable instructions. Sent first so providers can cache them. */
  system: string;
  /** Stable per-session data, such as the profile. Cacheable. */
  context?: string;
  /** The volatile part: this resume, this job, this question. */
  input: string;
  schema: z.ZodType<T>;
  effort?: 'low' | 'medium' | 'high';
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

export interface GenerateResult<T> {
  value: T;
  usage: Usage;
}

/** Everything the layers know about a provider. They never import an SDK. */
export interface LlmProvider {
  readonly id: ProviderId;
  listModels(): Promise<ModelInfo[]>;
  generateObject<T>(request: GenerateRequest<T>): Promise<GenerateResult<T>>;
}

/** A model problem that still used tokens, so the caller can log what it cost. */
export class ModelError extends Error {
  constructor(
    message: string,
    readonly usage?: Usage,
  ) {
    super(message);
  }
}

/** The model declined to answer (a safety refusal). */
export class RefusedError extends ModelError {
  constructor(usage?: Usage) {
    super('The model declined to process this content.', usage);
  }
}

/** The model answered, but not in the shape the layer asked for. */
export class InvalidOutputError extends ModelError {
  constructor(detail: string, usage?: Usage) {
    super(`The model's answer didn't match the expected format. ${detail}`, usage);
  }
}

/** The model ran out of output space before finishing. */
export class TruncatedError extends ModelError {
  constructor(usage?: Usage) {
    super('The model ran out of output space before finishing.', usage);
  }
}

/** Plain JSON Schema for a layer's output, for providers that take one directly. */
export function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest;
}

/** A layer has no model chosen, or its provider has no key yet. The message says what to do. */
export class NotConfiguredError extends Error {}
