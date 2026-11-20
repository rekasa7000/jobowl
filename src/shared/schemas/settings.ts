import { z } from 'zod';
import { aiSettingsSchema, defaultAiSettings, type AiSettings } from './ai';

export const themeSchema = z.enum(['dark', 'light', 'system']);
export type Theme = z.infer<typeof themeSchema>;

export const runSettingsSchema = z.object({
  /** How often a background run starts while jobowl is open (and on launch if one is overdue). */
  intervalHours: z.number().int().min(1).max(168),
  startWithWindows: z.boolean(),
});
export type RunSettings = z.infer<typeof runSettingsSchema>;
export const defaultRunSettings: RunSettings = { intervalHours: 6, startWithWindows: false };

/** One entry per setting. No defaults here: a patch must only touch what it names. */
const fields = { theme: themeSchema, ai: aiSettingsSchema, runs: runSettingsSchema };

export interface Settings {
  theme: Theme;
  ai: AiSettings;
  runs: RunSettings;
}

export const defaultSettings: Settings = {
  theme: 'dark',
  ai: defaultAiSettings,
  runs: defaultRunSettings,
};

export const settingsPatchSchema = z.object(fields).partial().strict();
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

/** Stored or returned settings: anything missing falls back to its default. */
export const settingsSchema = z
  .object(fields)
  .partial()
  .transform((stored): Settings => ({
    theme: stored.theme ?? defaultSettings.theme,
    ai: stored.ai ?? defaultSettings.ai,
    runs: stored.runs ?? defaultSettings.runs,
  }));
