import type { ApplicationEvent } from '@shared/schemas/application';
import { STATUS_LABELS, statusSchema } from '@shared/statuses';

function statusName(value: string | undefined): string {
  const parsed = statusSchema.safeParse(value);
  return parsed.success ? STATUS_LABELS[parsed.data] : (value ?? 'unknown');
}

export function eventLabel(event: ApplicationEvent): string {
  const { details } = event;
  switch (event.kind) {
    case 'created':
      return details['text'] ?? (details['via'] === 'manual' ? 'Added manually' : 'Added');
    case 'status_changed':
      return `Status changed from ${statusName(details['from'])} to ${statusName(details['to'])}`;
    case 'edited':
      return details['text'] ?? `Edited ${details['fields'] ?? 'details'}`;
    case 'note':
      return 'Notes updated';
  }
}

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

export function Timeline({ events }: { events: ApplicationEvent[] }) {
  return (
    <ol className="timeline">
      {events.map((event) => (
        <li key={event.id}>
          <time className="font-mono text-[0.8125rem] text-ink-3" dateTime={event.at}>
            {formatDate(event.at)}
          </time>
          <span>{eventLabel(event)}</span>
        </li>
      ))}
    </ol>
  );
}
