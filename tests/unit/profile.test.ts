import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emptyProfile, newId, profileSchema, type Profile } from '@shared/schemas/profile';
import { openDb, type Db } from '../../src/main/db/open';
import { createProfileRepo, type ProfileRepo } from '../../src/main/db/profile-repo';
import { dataPaths } from '../../src/main/paths';

const migrations = join(import.meta.dirname, '../../drizzle');

let root: string;
let db: Db;
let repo: ProfileRepo;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'jobowl-profile-'));
  db = await openDb(dataPaths(root), migrations);
  repo = createProfileRepo(db);
});

afterEach(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});

function sample(): Profile {
  const profile = emptyProfile();
  profile.person.fullName = 'Ada Lovelace';
  profile.experiences.push({
    id: newId('exp'),
    employer: 'Analytical Engines Ltd',
    title: 'Engineer',
    start: '2020-01',
    end: 'present',
    bullets: [
      {
        id: newId('blt'),
        text: 'Cut run time by 40% across 12 programs',
        metrics: ['bogus'],
        tags: [],
      },
    ],
    skills: [],
  });
  return profile;
}

describe('profile schema', () => {
  it('accepts an empty-but-named profile and rejects one with no name', () => {
    expect(
      profileSchema.safeParse({
        ...emptyProfile(),
        person: { ...emptyProfile().person, fullName: 'A' },
      }).success,
    ).toBe(true);
    expect(profileSchema.safeParse(emptyProfile()).success).toBe(false);
  });

  it('allows unknown dates to be empty but rejects made-up formats', () => {
    const profile = sample();
    const experience = profile.experiences[0];
    if (!experience) throw new Error('fixture');
    expect(
      profileSchema.safeParse({ ...profile, experiences: [{ ...experience, start: '' }] }).success,
    ).toBe(true);
    expect(
      profileSchema.safeParse({
        ...profile,
        experiences: [{ ...experience, start: 'last spring' }],
      }).success,
    ).toBe(false);
  });

  it('makes ids with a prefix and random tail', () => {
    expect(newId('exp')).toMatch(/^exp_[0-9a-f]{8}$/);
    expect(newId('exp')).not.toBe(newId('exp'));
  });
});

describe('profile repository', () => {
  it('has no profile until one is saved', () => {
    expect(repo.current()).toBeNull();
    expect(repo.list()).toEqual([]);
  });

  it('numbers versions upward and treats the latest as current', () => {
    const first = repo.save(sample(), 'First import');
    const edited = sample();
    edited.person.headline = 'Mathematician';
    const second = repo.save(edited);
    expect([first.version, second.version]).toEqual([1, 2]);
    expect(repo.current()?.profile.person.headline).toBe('Mathematician');
    expect(repo.list().map((v) => [v.version, v.note])).toEqual([
      [2, null],
      [1, 'First import'],
    ]);
  });

  it('keeps old versions unchanged when a new one is saved', () => {
    repo.save(sample());
    const edited = sample();
    edited.person.fullName = 'Someone Else';
    repo.save(edited);
    expect(repo.version(1)?.profile.person.fullName).toBe('Ada Lovelace');
  });

  it('re-derives bullet metrics from the text on save', () => {
    const saved = repo.save(sample());
    expect(saved.profile.experiences[0]?.bullets[0]?.metrics).toEqual(['40%', '12']);
  });

  it('refuses an invalid profile without writing anything', () => {
    expect(() => repo.save(emptyProfile())).toThrow();
    expect(repo.list()).toEqual([]);
  });

  it('records the file a version was imported from', () => {
    const saved = repo.save(sample(), undefined, {
      name: 'resume.pdf',
      path: 'files/imports/x.pdf',
      sha256: 'abc',
    });
    expect(saved.sourceName).toBe('resume.pdf');
  });
});
