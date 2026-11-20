import { and, asc, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import type {
  Application,
  ApplicationDetail,
  ApplicationEvent,
  ApplicationPatch,
  CreateApplication,
  EventKind,
  ListFilter,
} from '@shared/schemas/application';
import { statusPriority, statusSchema } from '@shared/statuses';
import { ulid } from '../ids';
import type { PreparedApplication } from '../legacy/v01';
import type { Db } from './open';
import { applicationEvents, applications } from './schema';

type Row = typeof applications.$inferSelect;
type EventRow = typeof applicationEvents.$inferSelect;

function toApplication(row: Row): Application {
  return {
    id: row.id,
    company: row.company,
    position: row.position,
    status: statusSchema.parse(row.status),
    channel: row.channel as Application['channel'],
    dateApplied: row.dateApplied,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastActivityAt: row.lastActivityAt,
  };
}

function toEvent(row: EventRow): ApplicationEvent {
  return {
    id: row.id,
    at: row.at,
    kind: row.kind as EventKind,
    details: JSON.parse(row.details) as Record<string, string>,
  };
}

/** Today in the user's own time zone, not UTC: an evening application is still "today". */
function localDate(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export class NotFoundError extends Error {
  constructor(id: string) {
    super(`No application with id ${id}`);
  }
}

export function createApplicationsRepo(db: Db, clock: () => Date = () => new Date()) {
  const { orm } = db;

  function detail(id: string): ApplicationDetail {
    const row = orm.select().from(applications).where(eq(applications.id, id)).get();
    if (!row) throw new NotFoundError(id);
    const events = orm
      .select()
      .from(applicationEvents)
      .where(eq(applicationEvents.applicationId, id))
      .orderBy(asc(applicationEvents.at), asc(applicationEvents.id))
      .all();
    return { application: toApplication(row), events: events.map(toEvent) };
  }

  return {
    /** Search matches company, position and notes. Sorted by status priority, then newest first. */
    list(filter: ListFilter = {}): Application[] {
      const conditions: (SQL | undefined)[] = [];
      if (filter.status && filter.status !== 'all') {
        conditions.push(eq(applications.status, filter.status));
      }
      const search = filter.search?.trim();
      if (search) {
        const contains = (column: AnySQLiteColumn) =>
          sql`instr(lower(${column}), lower(${search})) > 0`;
        conditions.push(
          or(
            contains(applications.company),
            contains(applications.position),
            contains(applications.notes),
          ),
        );
      }
      return orm
        .select()
        .from(applications)
        .where(and(...conditions))
        .all()
        .map(toApplication)
        .sort(
          (a, b) =>
            statusPriority(a.status) - statusPriority(b.status) ||
            (b.dateApplied ?? '').localeCompare(a.dateApplied ?? '') ||
            b.id.localeCompare(a.id),
        );
    },

    get: detail,

    create(input: CreateApplication): ApplicationDetail {
      const now = clock();
      const stamp = now.toISOString();
      const status = input.status ?? 'applied';
      const dateApplied =
        input.dateApplied !== undefined
          ? input.dateApplied
          : status === 'draft'
            ? null
            : localDate(now);
      const id = ulid();
      orm.transaction((tx) => {
        tx.insert(applications)
          .values({
            id,
            company: input.company,
            position: input.position,
            status,
            channel: 'manual',
            dateApplied,
            notes: input.notes ?? '',
            createdAt: stamp,
            updatedAt: stamp,
            lastActivityAt: stamp,
          })
          .run();
        tx.insert(applicationEvents)
          .values({
            id: ulid(),
            applicationId: id,
            at: stamp,
            kind: 'created',
            details: JSON.stringify({ via: 'manual' }),
          })
          .run();
      });
      return detail(id);
    },

    /** Applies the patch and records what changed: status moves, edited fields, notes. */
    update(id: string, patch: ApplicationPatch): ApplicationDetail {
      const before = detail(id).application;
      const now = clock();
      const stamp = now.toISOString();
      const events: { kind: EventKind; details: Record<string, string> }[] = [];

      const edited: string[] = [];
      if (patch.company !== undefined && patch.company !== before.company) edited.push('company');
      if (patch.position !== undefined && patch.position !== before.position) {
        edited.push('position');
      }
      let dateApplied = patch.dateApplied !== undefined ? patch.dateApplied : before.dateApplied;
      if (dateApplied !== before.dateApplied) edited.push('date applied');

      const status = patch.status ?? before.status;
      if (status !== before.status) {
        events.push({ kind: 'status_changed', details: { from: before.status, to: status } });
        if (before.status === 'draft' && dateApplied === null && patch.dateApplied === undefined) {
          dateApplied = localDate(now);
          edited.push('date applied');
        }
      }
      if (edited.length > 0)
        events.push({ kind: 'edited', details: { fields: edited.join(', ') } });
      if (patch.notes !== undefined && patch.notes !== before.notes) {
        events.push({ kind: 'note', details: {} });
      }
      if (events.length === 0) return detail(id);

      orm.transaction((tx) => {
        tx.update(applications)
          .set({
            company: patch.company ?? before.company,
            position: patch.position ?? before.position,
            status,
            dateApplied,
            notes: patch.notes ?? before.notes,
            updatedAt: stamp,
            lastActivityAt: stamp,
          })
          .where(eq(applications.id, id))
          .run();
        for (const event of events) {
          tx.insert(applicationEvents)
            .values({
              id: ulid(),
              applicationId: id,
              at: stamp,
              kind: event.kind,
              details: JSON.stringify(event.details),
            })
            .run();
        }
      });
      return detail(id);
    },

    /** Removes the application and, through the foreign key, its history. */
    remove(id: string): void {
      const result = orm.delete(applications).where(eq(applications.id, id)).run();
      if (result.changes === 0) throw new NotFoundError(id);
    },

    /** Legacy ids already present, so an import can skip them. */
    importedLegacyIds(ids: number[]): Set<number> {
      if (ids.length === 0) return new Set();
      const rows = orm
        .select({ legacyId: applications.legacyId })
        .from(applications)
        .where(inArray(applications.legacyId, ids))
        .all();
      return new Set(rows.flatMap((row) => (row.legacyId === null ? [] : [row.legacyId])));
    },

    importPrepared(items: PreparedApplication[]): void {
      const nowStamp = clock().toISOString();
      orm.transaction((tx) => {
        for (const item of items) {
          const id = ulid();
          const first = item.events[0]?.at ?? nowStamp;
          const last = item.events[item.events.length - 1]?.at ?? nowStamp;
          tx.insert(applications)
            .values({
              id,
              legacyId: item.legacyId,
              company: item.company,
              position: item.position,
              status: item.status,
              channel: 'manual',
              dateApplied: item.dateApplied,
              notes: item.notes,
              createdAt: first,
              updatedAt: nowStamp,
              lastActivityAt: last,
            })
            .run();
          for (const event of item.events) {
            tx.insert(applicationEvents)
              .values({
                id: ulid(),
                applicationId: id,
                at: event.at,
                kind: event.kind,
                details: JSON.stringify(event.details),
              })
              .run();
          }
        }
      });
    },
  };
}

export type ApplicationsRepo = ReturnType<typeof createApplicationsRepo>;
