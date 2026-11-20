import { z } from 'zod';
import { dateOnlySchema } from '@shared/schemas/application';
import { statusSchema, type Status } from '@shared/statuses';

/** The shape jobowl 0.1 wrote to `applications.json`. */
const legacyFileSchema = z.array(
  z.object({
    id: z.number().int().nonnegative(),
    company: z.string(),
    position: z.string(),
    status: z.string(),
    date_applied: z.string(),
    notes: z.string().default(''),
    activity_history: z
      .array(z.object({ date: z.string(), action: z.string(), details: z.string() }))
      .default([]),
  }),
);

/** The three entries 0.1 added to an empty tracker on first launch. */
const SAMPLES = new Set([
  'Google|Software Engineer|2024-01-15',
  'Microsoft|Senior Developer|2024-01-20',
  'Apple|iOS Developer|2024-01-25',
]);

export interface PreparedEvent {
  at: string;
  kind: 'created' | 'status_changed' | 'edited';
  details: Record<string, string>;
}

export interface PreparedApplication {
  legacyId: number;
  company: string;
  position: string;
  status: Status;
  dateApplied: string | null;
  notes: string;
  events: PreparedEvent[];
  isSample: boolean;
  statusWasUnknown: boolean;
}

export function parseLegacyFile(json: string): unknown[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('The file is not valid JSON.');
  }
  const parsed = legacyFileSchema.safeParse(raw);
  if (!parsed.success) throw new Error('The file is not a jobowl 0.1 applications list.');
  return parsed.data;
}

function toStatus(value: string): Status | null {
  const parsed = statusSchema.safeParse(value.trim().toLowerCase());
  return parsed.success ? parsed.data : null;
}

function toDate(value: string): string | null {
  const parsed = dateOnlySchema.safeParse(value.trim());
  return parsed.success ? parsed.data : null;
}

function eventTime(date: string): string {
  return `${toDate(date) ?? '1970-01-01'}T00:00:00.000Z`;
}

type LegacyEntry = z.infer<typeof legacyFileSchema>[number];

function prepareEvents(entry: LegacyEntry, dateApplied: string | null): PreparedEvent[] {
  const events: PreparedEvent[] = [];
  for (const item of entry.activity_history) {
    const at = eventTime(item.date);
    if (item.action === 'Applied') {
      events.push({ at, kind: 'created', details: { via: 'v0.1', text: item.details } });
      continue;
    }
    const changed = /^Changed from (.+) to (.+)$/.exec(item.details);
    const from = changed?.[1] ? toStatus(changed[1]) : null;
    const to = changed?.[2] ? toStatus(changed[2]) : null;
    if (item.action.startsWith('Status changed') && from && to) {
      events.push({ at, kind: 'status_changed', details: { from, to } });
    } else {
      events.push({ at, kind: 'edited', details: { text: `${item.action}: ${item.details}` } });
    }
  }
  if (!events.some((event) => event.kind === 'created')) {
    const at = eventTime(dateApplied ?? entry.activity_history[0]?.date ?? '');
    events.unshift({ at, kind: 'created', details: { via: 'v0.1' } });
  }
  return events.sort((a, b) => a.at.localeCompare(b.at));
}

export function prepareLegacy(entries: unknown[]): PreparedApplication[] {
  return (entries as LegacyEntry[]).map((entry) => {
    const status = toStatus(entry.status);
    const dateApplied = toDate(entry.date_applied);
    const key = `${entry.company}|${entry.position}|${entry.date_applied}`;
    return {
      legacyId: entry.id,
      company: entry.company.trim() || 'Unknown company',
      position: entry.position.trim() || 'Unknown position',
      status: status ?? 'applied',
      dateApplied,
      notes: entry.notes,
      events: prepareEvents(entry, dateApplied),
      isSample:
        SAMPLES.has(key) &&
        entry.notes === '' &&
        entry.status === 'Applied' &&
        entry.activity_history.length <= 1,
      statusWasUnknown: status === null,
    };
  });
}
