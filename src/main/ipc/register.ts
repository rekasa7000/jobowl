import type { IpcMainInvokeEvent } from 'electron';
import { readSettings, writeSettings } from '../db/settings-repo';
import type { Db } from '../db/open';
import { handle } from './handle';

export interface AppContext {
  db: Db;
  version: string;
  platform: string;
  dataDir: string;
  isTrusted: (event: IpcMainInvokeEvent) => boolean;
}

export function registerIpc(ctx: AppContext): void {
  handle('app:info', ctx.isTrusted, () => ({
    name: 'jobowl' as const,
    version: ctx.version,
    platform: ctx.platform,
    dataDir: ctx.dataDir,
    schemaVersion: ctx.db.schemaVersion,
  }));
  handle('settings:get', ctx.isTrusted, () => readSettings(ctx.db));
  handle('settings:update', ctx.isTrusted, (patch) => writeSettings(ctx.db, patch));
}
