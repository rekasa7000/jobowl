import { z } from 'zod';

export const providerIdSchema = z.enum(['anthropic', 'openai', 'ollama', 'openai_compatible']);
export type ProviderId = z.infer<typeof providerIdSchema>;

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  ollama: 'Ollama (on this PC)',
  openai_compatible: 'OpenAI-compatible server',
};

/** Providers that need an API key. Ollama doesn't; a compatible server's key is optional. */
export const keyProviderSchema = z.enum(['anthropic', 'openai', 'openai_compatible']);
export type KeyProvider = z.infer<typeof keyProviderSchema>;

export const layerSchema = z.enum([
  'parser',
  'extractor',
  'scorer',
  'tailor',
  'checker',
  'writer',
  'form_mapper',
]);
export type Layer = z.infer<typeof layerSchema>;

/** Layers that exist in this release. The rest join as their milestones land. */
export const ACTIVE_LAYERS: readonly Layer[] = ['parser', 'scorer'];

export const LAYER_LABELS: Record<Layer, { name: string; job: string }> = {
  parser: { name: 'Parser', job: 'Reads your resume into a draft profile' },
  extractor: { name: 'Extractor', job: 'Reads job details from career pages' },
  scorer: { name: 'Scorer', job: 'Rates how well a job fits you' },
  tailor: { name: 'Tailor', job: 'Builds a resume for one job' },
  checker: { name: 'Checker', job: 'Verifies every tailored line' },
  writer: { name: 'Writer', job: 'Drafts emails and free-text answers' },
  form_mapper: { name: 'Form mapper', job: 'Matches form fields to your profile' },
};

const httpUrl = z
  .string()
  .max(300)
  .refine(
    (value) => value === '' || /^https?:\/\//.test(value),
    'Use an http:// or https:// address',
  );

export const layerChoiceSchema = z.object({
  provider: providerIdSchema,
  model: z.string().trim().min(1).max(200),
});
export type LayerChoice = z.infer<typeof layerChoiceSchema>;

export const aiSettingsSchema = z.object({
  layers: z.partialRecord(layerSchema, layerChoiceSchema),
  ollamaUrl: httpUrl,
  compatibleUrl: httpUrl,
  monthlyCapUsd: z.number().min(0).max(10_000),
});
export type AiSettings = z.infer<typeof aiSettingsSchema>;

export const defaultAiSettings: AiSettings = {
  layers: {},
  ollamaUrl: 'http://127.0.0.1:11434',
  compatibleUrl: '',
  monthlyCapUsd: 10,
};

export const providerStatusSchema = z.object({
  id: providerIdSchema,
  /** A key is saved, or (for Ollama) nothing is needed. */
  ready: z.boolean(),
  needsKey: z.boolean(),
  /** Last four characters of the saved key, so you can tell which one is stored. */
  keyHint: z.string().nullable(),
});
export type ProviderStatus = z.infer<typeof providerStatusSchema>;

export const aiStatusSchema = z.object({
  /** False when Windows can't encrypt keys; jobowl then refuses to store them. */
  secretsAvailable: z.boolean(),
  providers: z.array(providerStatusSchema),
});
export type AiStatus = z.infer<typeof aiStatusSchema>;

export const setKeySchema = z.object({
  provider: keyProviderSchema,
  key: z.string().trim().min(1).max(500),
});
export const clearKeySchema = z.object({ provider: keyProviderSchema });
export const listModelsSchema = z.object({ provider: providerIdSchema });
export const modelInfoSchema = z.object({ id: z.string(), label: z.string() });
export type ModelInfo = z.infer<typeof modelInfoSchema>;

export const testModelSchema = layerChoiceSchema;
export const testResultSchema = z.object({
  ok: z.boolean(),
  ms: z.number().int().nonnegative(),
  error: z.string().optional(),
});
export type TestResult = z.infer<typeof testResultSchema>;

export const spendSchema = z.object({
  monthUsd: z.number().nonnegative(),
  calls: z.number().int().nonnegative(),
  /** Calls to models with no known price; their cost isn't in `monthUsd`. */
  unpriced: z.number().int().nonnegative(),
  byLayer: z.array(z.object({ layer: z.string(), calls: z.number().int(), usd: z.number() })),
});
export type Spend = z.infer<typeof spendSchema>;
