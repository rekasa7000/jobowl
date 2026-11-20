import { z } from 'zod';
import { aiSettingsSchema, defaultAiSettings, type AiSettings } from './ai';

export const themeSchema = z.enum(['dark', 'light', 'system']);
export type Theme = z.infer<typeof themeSchema>;

/** One entry per setting. No defaults here: a patch must only touch what it names. */
const fields = { theme: themeSchema, ai: aiSettingsSchema };

export interface Settings {
  theme: Theme;
  ai: AiSettings;
}

export const defaultSettings: Settings = { theme: 'dark', ai: defaultAiSettings };

export const settingsPatchSchema = z.object(fields).partial().strict();
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

/** Stored or returned settings: anything missing falls back to its default. */
export const settingsSchema = z
  .object(fields)
  .partial()
  .transform((stored): Settings => ({
    theme: stored.theme ?? defaultSettings.theme,
    ai: stored.ai ?? defaultSettings.ai,
  }));
