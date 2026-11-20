import type { IpcMainInvokeEvent } from 'electron';
import { createAiCallsRepo } from '../db/ai-calls-repo';
import { createApplicationsRepo } from '../db/applications-repo';
import type { Db } from '../db/open';
import { createProfileRepo } from '../db/profile-repo';
import { readSettings, writeSettings } from '../db/settings-repo';
import { detectLegacy, importLegacy } from '../legacy/import';
import { SECRET_NAMES, createProviderFactory } from '../ai/registry';
import { testModel } from '../ai/test-model';
import { createSecretStore, type Cipher } from '../secrets/secret-store';
import { providerIdSchema, type AiStatus, type KeyProvider } from '@shared/schemas/ai';
import { handle } from './handle';

export interface AppContext {
  db: Db;
  version: string;
  platform: string;
  dataDir: string;
  /** Where jobowl 0.1 kept its data. Only main ever reads it. */
  legacyFile: string;
  /** The operating system's encryption for API keys. */
  cipher: Cipher;
  isTrusted: (event: IpcMainInvokeEvent) => boolean;
}

export function registerIpc(ctx: AppContext): void {
  const apps = createApplicationsRepo(ctx.db);
  const profiles = createProfileRepo(ctx.db);
  const secrets = createSecretStore(ctx.db, ctx.cipher);
  const aiCalls = createAiCallsRepo(ctx.db);
  const providerFor = createProviderFactory(() => readSettings(ctx.db).ai, secrets);
  const { isTrusted } = ctx;

  function aiStatus(): AiStatus {
    const ai = readSettings(ctx.db).ai;
    return {
      secretsAvailable: secrets.available(),
      providers: providerIdSchema.options.map((id) => {
        const needsKey = id !== 'ollama';
        const keyHint = needsKey ? secrets.hint(SECRET_NAMES[id]) : null;
        const ready =
          id === 'ollama'
            ? true
            : id === 'openai_compatible'
              ? ai.compatibleUrl !== ''
              : keyHint !== null;
        return { id, needsKey, keyHint, ready };
      }),
    };
  }

  handle('app:info', isTrusted, () => ({
    name: 'jobowl' as const,
    version: ctx.version,
    platform: ctx.platform,
    dataDir: ctx.dataDir,
    schemaVersion: ctx.db.schemaVersion,
  }));
  handle('settings:get', isTrusted, () => readSettings(ctx.db));
  handle('settings:update', isTrusted, (patch) => writeSettings(ctx.db, patch));

  handle('applications:list', isTrusted, (filter) => apps.list(filter));
  handle('applications:get', isTrusted, (id) => apps.get(id));
  handle('applications:create', isTrusted, (input) => apps.create(input));
  handle('applications:update', isTrusted, ({ id, patch }) => apps.update(id, patch));
  handle('applications:delete', isTrusted, (id) => {
    apps.remove(id);
    return undefined;
  });

  handle('ai:status', isTrusted, () => aiStatus());
  handle('ai:set-key', isTrusted, ({ provider, key }) => {
    secrets.set(SECRET_NAMES[provider as KeyProvider], key);
    return aiStatus();
  });
  handle('ai:clear-key', isTrusted, ({ provider }) => {
    secrets.delete(SECRET_NAMES[provider]);
    return aiStatus();
  });
  handle('ai:models', isTrusted, ({ provider }) => providerFor(provider).listModels());
  handle('ai:test', isTrusted, (choice) =>
    testModel(() => providerFor(choice.provider), choice, aiCalls),
  );
  handle('ai:spend', isTrusted, () => aiCalls.spendThisMonth());

  handle('profile:get', isTrusted, () => profiles.current());
  handle('profile:versions', isTrusted, () => profiles.list());
  handle('profile:save', isTrusted, ({ profile, note }) => profiles.save(profile, note));

  handle('legacy:detect', isTrusted, () => detectLegacy(ctx.legacyFile, apps));
  handle('legacy:import', isTrusted, ({ includeSamples }) =>
    importLegacy(ctx.legacyFile, apps, includeSamples),
  );
}
