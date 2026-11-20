import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createApplicationsRepo,
  NotFoundError,
  type ApplicationsRepo,
} from '../../src/main/db/applications-repo';
import { openDb, type Db } from '../../src/main/db/open';
import { dataPaths } from '../../src/main/paths';
import { ulid } from '../../src/main/ids';

const migrations = join(import.meta.dirname, '../../drizzle');

let root: string;
let db: Db;
let repo: ApplicationsRepo;
let now: Date;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'jobowl-apps-'));
  db = await openDb(dataPaths(root), migrations);
  now = new Date(2025, 5, 10, 23, 30); // 10 June 2025, 23:30 local: late evening on purpose
  repo = createApplicationsRepo(db, () => now);
});

afterEach(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});

describe('create', () => {
  it('defaults to applied today in local time, with a created event', () => {
    const { application, events } = repo.create({ company: 'Acme', position: 'Engineer' });
    expect(application.status).toBe('applied');
    expect(application.dateApplied).toBe('2025-06-10');
    expect(application.channel).toBe('manual');
    expect(events.map((e) => e.kind)).toEqual(['created']);
    expect(events[0]?.details).toEqual({ via: 'manual' });
  });

  it('leaves the date empty for a draft', () => {
    const { application } = repo.create({ company: 'Acme', position: 'Engineer', status: 'draft' });
    expect(application.dateApplied).toBeNull();
  });

  it('keeps an explicit date and notes', () => {
    const { application } = repo.create({
      company: 'Acme',
      position: 'Engineer',
      dateApplied: '2025-01-02',
      notes: 'Via Dana',
    });
    expect(application.dateApplied).toBe('2025-01-02');
    expect(application.notes).toBe('Via Dana');
  });
});

describe('update', () => {
  it('records a status change with where it came from', () => {
    const { application } = repo.create({ company: 'Acme', position: 'Engineer' });
    const { events, application: after } = repo.update(application.id, { status: 'interview' });
    expect(after.status).toBe('interview');
    expect(events.at(-1)).toMatchObject({
      kind: 'status_changed',
      details: { from: 'applied', to: 'interview' },
    });
  });

  it('records which fields were edited, and notes separately', () => {
    const { application } = repo.create({ company: 'Acme', position: 'Engineer' });
    const { events } = repo.update(application.id, {
      company: 'Acme Robotics',
      notes: 'Phone screen booked',
    });
    expect(events.map((e) => e.kind)).toEqual(['created', 'edited', 'note']);
    expect(events[1]?.details).toEqual({ fields: 'company' });
  });

  it('writes nothing when the patch changes nothing', () => {
    const { application } = repo.create({ company: 'Acme', position: 'Engineer' });
    const { events } = repo.update(application.id, { company: 'Acme', status: 'applied' });
    expect(events).toHaveLength(1);
  });

  it('leaves untouched fields alone', () => {
    const { application } = repo.create({
      company: 'Acme',
      position: 'Engineer',
      notes: 'keep me',
    });
    const after = repo.update(application.id, { position: 'Senior Engineer' }).application;
    expect(after.notes).toBe('keep me');
    expect(after.company).toBe('Acme');
  });

  it('stamps today when a draft becomes applied without a date', () => {
    const { application } = repo.create({ company: 'Acme', position: 'Engineer', status: 'draft' });
    const after = repo.update(application.id, { status: 'applied' }).application;
    expect(after.dateApplied).toBe('2025-06-10');
  });

  it('throws NotFoundError for an unknown id', () => {
    expect(() => repo.update(ulid(), { notes: 'x' })).toThrow(NotFoundError);
  });
});

describe('remove', () => {
  it('deletes the application and its history', () => {
    const { application } = repo.create({ company: 'Acme', position: 'Engineer' });
    repo.update(application.id, { status: 'offer' });
    repo.remove(application.id);
    expect(repo.list()).toEqual([]);
    const left = db.sqlite.prepare('select count(*) as n from application_events').get() as {
      n: number;
    };
    expect(left.n).toBe(0);
  });

  it('throws NotFoundError for an unknown id', () => {
    expect(() => repo.remove(ulid())).toThrow(NotFoundError);
  });
});

describe('list', () => {
  function seed() {
    repo.create({
      company: 'Old Rejection',
      position: 'Dev',
      status: 'rejected',
      dateApplied: '2025-01-01',
    });
    repo.create({ company: 'Fresh Apply', position: 'Dev', dateApplied: '2025-05-01' });
    repo.create({ company: 'Older Apply', position: 'Dev', dateApplied: '2025-02-01' });
    repo.create({
      company: 'Big Interview',
      position: 'Staff',
      status: 'interview',
      dateApplied: '2025-03-01',
    });
    repo.create({
      company: 'Gone',
      position: 'Dev',
      status: 'withdrawn',
      dateApplied: '2025-04-01',
    });
    repo.create({
      company: 'The Offer',
      position: 'Dev',
      status: 'offer',
      dateApplied: '2025-03-15',
    });
  }

  it('sorts by status priority, then newest date first', () => {
    seed();
    expect(repo.list().map((a) => a.company)).toEqual([
      'Big Interview',
      'The Offer',
      'Fresh Apply',
      'Older Apply',
      'Old Rejection',
      'Gone',
    ]);
  });

  it('filters by status', () => {
    seed();
    expect(repo.list({ status: 'applied' }).map((a) => a.company)).toEqual([
      'Fresh Apply',
      'Older Apply',
    ]);
    expect(repo.list({ status: 'all' })).toHaveLength(6);
  });

  it('searches company, position and notes, ignoring case', () => {
    seed();
    repo.create({ company: 'Zed', position: 'Designer', notes: 'Met at the ROBOTICS meetup' });
    expect(repo.list({ search: 'staff' }).map((a) => a.company)).toEqual(['Big Interview']);
    expect(repo.list({ search: 'FRESH' }).map((a) => a.company)).toEqual(['Fresh Apply']);
    expect(repo.list({ search: 'robotics' }).map((a) => a.company)).toEqual(['Zed']);
  });

  it('treats % and _ in a search as plain characters', () => {
    seed();
    expect(repo.list({ search: '%' })).toEqual([]);
    expect(repo.list({ search: '_' })).toEqual([]);
  });

  it('combines search and status filters', () => {
    seed();
    expect(repo.list({ search: 'dev', status: 'rejected' }).map((a) => a.company)).toEqual([
      'Old Rejection',
    ]);
  });
});
