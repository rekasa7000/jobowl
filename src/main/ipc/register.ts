import type { IpcMainInvokeEvent } from 'electron';
import { createAiCallsRepo } from '../db/ai-calls-repo';
import { createDiscoveryRepo } from '../db/discovery-repo';
import { createOrchestrator, type Orchestrator } from '../runs/orchestrator';
import { connectors, detectSource } from '../sources/registry';
import type { Http } from '../sources/http';
import { createApplicationsRepo } from '../db/applications-repo';
import type { Db } from '../db/open';
import { createProfileRepo } from '../db/profile-repo';
import { readSettings, writeSettings } from '../db/settings-repo';
import { detectLegacy, importLegacy } from '../legacy/import';
import { SECRET_NAMES, createProviderFactory } from '../ai/registry';
import { testModel } from '../ai/test-model';
import { parseResume } from '../ai/layers/parser';
import { createImporter } from '../resume/importer';
import { dataPaths } from '../paths';
import { createSecretStore, type Cipher } from '../secrets/secret-store';
import { providerIdSchema, type AiStatus } from '@shared/schemas/ai';
import { handle } from './handle';

export interface AppContext {
  db: Db;
  version: string;
  platform: string;
  dataDir: string;
  /** Where jobowl 0.1 kept its data. Only main ever reads it. */
  legacyFile: string;
  /** Shows the native file picker and reads the chosen file, or returns null if cancelled. */
  pickResumeFile: () => Promise<{ name: string; bytes: Uint8Array } | null>;
  /** Reads resume text in a separate process. */
  extractResume: (bytes: Uint8Array) => Promise<string>;
  /** Fetches from job sources. */
  http: Http;
  /** Tells you about new strong matches. */
  notify: (matches: { title: string; company: string; score: number }[]) => void;
  /** Turns "start with Windows" on or off. */
  setLoginItem: (open: boolean) => void;
  /** The operating system's encryption for API keys. */
  cipher: Cipher;
  isTrusted: (event: IpcMainInvokeEvent) => boolean;
}

export function registerIpc(ctx: AppContext): { orchestrator: Orchestrator } {
  const apps = createApplicationsRepo(ctx.db);
  const profiles = createProfileRepo(ctx.db);
  const secrets = createSecretStore(ctx.db, ctx.cipher);
  const aiCalls = createAiCallsRepo(ctx.db);
  const providerFor = createProviderFactory(() => readSettings(ctx.db).ai, secrets);
  const ai = { getSettings: () => readSettings(ctx.db).ai, providerFor, calls: aiCalls };
  const importer = createImporter({
    paths: dataPaths(ctx.dataDir),
    extract: ctx.extractResume,
    parse: (text) => parseResume(ai, text),
  });
  const discovery = createDiscoveryRepo(ctx.db);
  const orchestrator = createOrchestrator({
    repo: discovery,
    profile: () => {
      const saved = profiles.current();
      return saved ? { version: saved.version, profile: saved.profile } : null;
    },
    ai,
    calls: aiCalls,
    settings: () => readSettings(ctx.db),
    connectors,
    http: ctx.http,
    secret: (name) => secrets.get(name),
    notify: ctx.notify,
  });
  const adzunaHint = () => ({ adzunaKeyHint: secrets.hint('adzuna_app_key') });
  const { isTrusted } = ctx;

  async function aiStatus(): Promise<AiStatus> {
    const ai = readSettings(ctx.db).ai;
    return {
      secretsAvailable: await secrets.available(),
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
  handle('settings:update', isTrusted, (patch) => {
    const next = writeSettings(ctx.db, patch);
    if (patch.runs) ctx.setLoginItem(next.runs.startWithWindows);
    return next;
  });

  handle('applications:list', isTrusted, (filter) => apps.list(filter));
  handle('applications:get', isTrusted, (id) => apps.get(id));
  handle('applications:create', isTrusted, (input) => apps.create(input));
  handle('applications:update', isTrusted, ({ id, patch }) => apps.update(id, patch));
  handle('applications:delete', isTrusted, (id) => {
    apps.remove(id);
    return undefined;
  });

  handle('ai:status', isTrusted, () => aiStatus());
  handle('ai:set-key', isTrusted, async ({ provider, key }) => {
    await secrets.set(SECRET_NAMES[provider], key);
    return aiStatus();
  });
  handle('ai:clear-key', isTrusted, ({ provider }) => {
    secrets.delete(SECRET_NAMES[provider]);
    return aiStatus();
  });
  handle('ai:models', isTrusted, async ({ provider }) =>
    (await providerFor(provider)).listModels(),
  );
  handle('ai:test', isTrusted, (choice) =>
    testModel(() => providerFor(choice.provider), choice, aiCalls),
  );
  handle('ai:spend', isTrusted, () => aiCalls.spendThisMonth());

  handle('profile:get', isTrusted, () => profiles.current());
  handle('profile:versions', isTrusted, () => profiles.list());
  handle('profile:save', isTrusted, ({ profile, note, importId }) =>
    profiles.save(profile, note, importId ? importer.sourceFor(importId) : undefined),
  );
  handle('resume:import-file', isTrusted, async () => {
    const file = await ctx.pickResumeFile();
    return file ? importer.run(file) : null;
  });
  handle('resume:import-text', isTrusted, ({ text }) =>
    importer.run({ name: 'pasted-resume.txt', bytes: new TextEncoder().encode(text) }),
  );

  handle('searches:list', isTrusted, () => discovery.listSearches());
  handle('searches:create', isTrusted, (fields) => discovery.createSearch(fields));
  handle('searches:update', isTrusted, ({ id, patch }) => discovery.updateSearch(id, patch));
  handle('searches:delete', isTrusted, (id) => {
    discovery.deleteSearch(id);
    return undefined;
  });

  handle('sources:list', isTrusted, () => discovery.listSources());
  handle('sources:detect', isTrusted, ({ url }) => detectSource(url));
  handle('sources:add', isTrusted, ({ type, config, label }) => {
    const checked = connectors[type].configSchema.safeParse(config);
    if (!checked.success) {
      throw new Error(checked.error.issues[0]?.message ?? "This source's settings are incomplete.");
    }
    return discovery.addSource(type, config, label?.trim() || type);
  });
  handle('sources:update', isTrusted, ({ id, patch }) => discovery.updateSource(id, patch));
  handle('sources:delete', isTrusted, (id) => {
    discovery.deleteSource(id);
    return undefined;
  });

  handle('jobs:list', isTrusted, (filter) => discovery.listJobs(filter));
  handle('jobs:get', isTrusted, (id) => {
    const job = discovery.getJob(id);
    if (!job) throw new Error('That job no longer exists.');
    return job;
  });
  handle('jobs:set-state', isTrusted, ({ id, state, reason }) => {
    discovery.setJobState(id, state, reason);
    return undefined;
  });

  handle('runs:status', isTrusted, () => orchestrator.status());
  handle('runs:start', isTrusted, () => {
    void orchestrator.start('manual');
    return orchestrator.status();
  });

  handle('integrations:status', isTrusted, () => adzunaHint());
  handle('integrations:set-adzuna-key', isTrusted, async ({ key }) => {
    await secrets.set('adzuna_app_key', key);
    return adzunaHint();
  });
  handle('integrations:clear-adzuna-key', isTrusted, () => {
    secrets.delete('adzuna_app_key');
    return adzunaHint();
  });

  handle('legacy:detect', isTrusted, () => detectLegacy(ctx.legacyFile, apps));
  handle('legacy:import', isTrusted, ({ includeSamples }) =>
    importLegacy(ctx.legacyFile, apps, includeSamples),
  );

  return { orchestrator };
}
