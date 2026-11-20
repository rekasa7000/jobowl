import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApplicationsRepo, type ApplicationsRepo } from '../../src/main/db/applications-repo';
import { openDb, type Db } from '../../src/main/db/open';
import { detectLegacy, importLegacy } from '../../src/main/legacy/import';
import { dataPaths } from '../../src/main/paths';

const migrations = join(import.meta.dirname, '../../drizzle');
const fixture = join(import.meta.dirname, '../fixtures/legacy/applications.json');

let root: string;
let db: Db;
let repo: ApplicationsRepo;
let file: string;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'jobowl-legacy-'));
  db = await openDb(dataPaths(root), migrations);
  repo = createApplicationsRepo(db);
  file = join(root, 'applications.json');
  copyFileSync(fixture, file);
});

afterEach(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});

describe('detectLegacy', () => {
  it('reports a missing file without an error', () => {
    expect(detectLegacy(join(root, 'nope.json'), repo)).toMatchObject({ found: false, total: 0 });
  });

  it('counts entries and spots the three first-launch samples', () => {
    expect(detectLegacy(file, repo)).toMatchObject({ found: true, total: 5, samples: 3 });
  });

  it('reports a broken file as an error instead of throwing', () => {
    writeFileSync(file, '{ not json');
    expect(detectLegacy(file, repo)).toMatchObject({
      found: true,
      error: 'The file is not valid JSON.',
    });
  });

  it('rejects JSON that is not a 0.1 list', () => {
    writeFileSync(file, '{"hello":"world"}');
    expect(detectLegacy(file, repo).error).toMatch(/not a jobowl 0.1/);
  });
});

describe('importLegacy', () => {
  it('skips the samples by default and keeps real entries with notes and history', () => {
    const result = importLegacy(file, repo, false);
    expect(result).toEqual({
      imported: 2,
      skippedExisting: 0,
      skippedSamples: 3,
      unknownStatus: 1,
    });

    const acme = repo.list({ search: 'acme' })[0];
    expect(acme).toMatchObject({
      status: 'interview',
      dateApplied: '2024-03-02',
      notes: 'Referred by Dana. Phone screen went well.',
    });
    const { events } = repo.get(acme?.id ?? '');
    expect(events.map((e) => e.kind)).toEqual(['created', 'status_changed']);
    expect(events[1]?.details).toEqual({ from: 'applied', to: 'interview' });
    expect(events[1]?.at).toBe('2024-03-09T00:00:00.000Z');
  });

  it('includes the samples when asked', () => {
    expect(importLegacy(file, repo, true).imported).toBe(5);
  });

  it('sets an unknown status to applied, drops an invalid date, and says so', () => {
    importLegacy(file, repo, false);
    const globex = repo.list({ search: 'globex' })[0];
    expect(globex).toMatchObject({ status: 'applied', dateApplied: null });
    expect(repo.get(globex?.id ?? '').events.map((e) => e.kind)).toEqual(['created']);
  });

  it('never imports the same entry twice', () => {
    importLegacy(file, repo, false);
    const again = importLegacy(file, repo, false);
    expect(again).toMatchObject({ imported: 0, skippedExisting: 2 });
    expect(repo.list()).toHaveLength(2);
    expect(detectLegacy(file, repo)).toMatchObject({ alreadyImported: 2 });
  });
});
