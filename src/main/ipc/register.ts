import type { IpcMainInvokeEvent } from 'electron';
import { createApplicationsRepo } from '../db/applications-repo';
import type { Db } from '../db/open';
import { readSettings, writeSettings } from '../db/settings-repo';
import { detectLegacy, importLegacy } from '../legacy/import';
import { handle } from './handle';

export interface AppContext {
  db: Db;
  version: string;
  platform: string;
  dataDir: string;
  /** Where jobowl 0.1 kept its data. Only main ever reads it. */
  legacyFile: string;
  isTrusted: (event: IpcMainInvokeEvent) => boolean;
}

export function registerIpc(ctx: AppContext): void {
  const apps = createApplicationsRepo(ctx.db);
  const { isTrusted } = ctx;

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

  handle('legacy:detect', isTrusted, () => detectLegacy(ctx.legacyFile, apps));
  handle('legacy:import', isTrusted, ({ includeSamples }) =>
    importLegacy(ctx.legacyFile, apps, includeSamples),
  );
}
