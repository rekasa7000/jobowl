import { z } from 'zod';

export const themeSchema = z.enum(['dark', 'light', 'system']);
export type Theme = z.infer<typeof themeSchema>;

/** One entry per setting. No defaults here: a patch must only touch what it names. */
const fields = { theme: themeSchema };

export type Settings = { [K in keyof typeof fields]: z.infer<(typeof fields)[K]> };

export const defaultSettings: Settings = { theme: 'dark' };

export const settingsPatchSchema = z.object(fields).partial().strict();
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

/** Stored or returned settings: anything missing falls back to its default. */
export const settingsSchema = z
  .object(fields)
  .partial()
  .transform((stored): Settings => ({ theme: stored.theme ?? defaultSettings.theme }));
