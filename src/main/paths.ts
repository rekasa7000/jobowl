import { join } from 'node:path';

export interface DataPaths {
  root: string;
  db: string;
  backups: string;
  logs: string;
  files: string;
}

export function dataPaths(root: string): DataPaths {
  return {
    root,
    db: join(root, 'jobowl.db'),
    backups: join(root, 'backups'),
    logs: join(root, 'logs'),
    files: join(root, 'files'),
  };
}
