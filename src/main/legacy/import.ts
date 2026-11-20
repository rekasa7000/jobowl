import { existsSync, readFileSync, statSync } from 'node:fs';
import type { LegacyDetect, LegacyImportResult } from '@shared/schemas/application';
import type { ApplicationsRepo } from '../db/applications-repo';
import { parseLegacyFile, prepareLegacy } from './v01';

const MAX_BYTES = 5 * 1024 * 1024;

function load(path: string) {
  if (statSync(path).size > MAX_BYTES) throw new Error('The file is larger than 5 MB.');
  return prepareLegacy(parseLegacyFile(readFileSync(path, 'utf8')));
}

export function detectLegacy(path: string, repo: ApplicationsRepo): LegacyDetect {
  if (!existsSync(path)) {
    return { found: false, path, total: 0, samples: 0, alreadyImported: 0 };
  }
  try {
    const items = load(path);
    const done = repo.importedLegacyIds(items.map((item) => item.legacyId));
    return {
      found: true,
      path,
      total: items.length,
      samples: items.filter((item) => item.isSample && !done.has(item.legacyId)).length,
      alreadyImported: done.size,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { found: true, path, total: 0, samples: 0, alreadyImported: 0, error: message };
  }
}

export function importLegacy(
  path: string,
  repo: ApplicationsRepo,
  includeSamples: boolean,
): LegacyImportResult {
  const items = load(path);
  const done = repo.importedLegacyIds(items.map((item) => item.legacyId));
  const fresh = items.filter((item) => !done.has(item.legacyId));
  const wanted = fresh.filter((item) => includeSamples || !item.isSample);
  repo.importPrepared(wanted);
  return {
    imported: wanted.length,
    skippedExisting: items.length - fresh.length,
    skippedSamples: fresh.length - wanted.length,
    unknownStatus: wanted.filter((item) => item.statusWasUnknown).length,
  };
}
