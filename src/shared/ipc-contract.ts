import { z } from 'zod';
import {
  aiStatusSchema,
  clearKeySchema,
  listModelsSchema,
  modelInfoSchema,
  setKeySchema,
  spendSchema,
  testModelSchema,
  testResultSchema,
} from './schemas/ai';
import {
  applicationDetailSchema,
  applicationSchema,
  createApplicationSchema,
  idSchema,
  legacyDetectSchema,
  legacyImportResultSchema,
  listFilterSchema,
  updateApplicationSchema,
} from './schemas/application';
import {
  importDraftSchema,
  importTextSchema,
  profileVersionSchema,
  saveProfileSchema,
  savedProfileSchema,
} from './schemas/profile';
import { settingsPatchSchema, settingsSchema } from './schemas/settings';

export const appInfoSchema = z.object({
  name: z.literal('jobowl'),
  version: z.string(),
  platform: z.string(),
  dataDir: z.string(),
  schemaVersion: z.number().int().nonnegative(),
});
export type AppInfo = z.infer<typeof appInfoSchema>;

/** Every request/response channel between renderer and main. Add new ones here first. */
export const ipcContract = {
  'app:info': { input: z.undefined(), output: appInfoSchema },
  'settings:get': { input: z.undefined(), output: settingsSchema },
  'settings:update': { input: settingsPatchSchema, output: settingsSchema },
  'applications:list': { input: listFilterSchema, output: z.array(applicationSchema) },
  'applications:get': { input: idSchema, output: applicationDetailSchema },
  'applications:create': { input: createApplicationSchema, output: applicationDetailSchema },
  'applications:update': { input: updateApplicationSchema, output: applicationDetailSchema },
  'applications:delete': { input: idSchema, output: z.undefined() },
  'ai:status': { input: z.undefined(), output: aiStatusSchema },
  'ai:set-key': { input: setKeySchema, output: aiStatusSchema },
  'ai:clear-key': { input: clearKeySchema, output: aiStatusSchema },
  'ai:models': { input: listModelsSchema, output: z.array(modelInfoSchema) },
  'ai:test': { input: testModelSchema, output: testResultSchema },
  'ai:spend': { input: z.undefined(), output: spendSchema },
  'resume:import-file': { input: z.undefined(), output: importDraftSchema.nullable() },
  'resume:import-text': { input: importTextSchema, output: importDraftSchema },
  'profile:get': { input: z.undefined(), output: savedProfileSchema.nullable() },
  'profile:versions': { input: z.undefined(), output: z.array(profileVersionSchema) },
  'profile:save': { input: saveProfileSchema, output: savedProfileSchema },
  'legacy:detect': { input: z.undefined(), output: legacyDetectSchema },
  'legacy:import': {
    input: z.object({ includeSamples: z.boolean() }),
    output: legacyImportResultSchema,
  },
} as const;

export type IpcChannel = keyof typeof ipcContract;
export type IpcInput<C extends IpcChannel> = z.input<(typeof ipcContract)[C]['input']>;
export type IpcOutput<C extends IpcChannel> = z.output<(typeof ipcContract)[C]['output']>;

/** The only object the preload script exposes to the renderer. */
export interface JobowlApi {
  invoke<C extends IpcChannel>(channel: C, input?: IpcInput<C>): Promise<IpcOutput<C>>;
}
