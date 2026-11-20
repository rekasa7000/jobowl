import { STATUS_LABELS, statusSchema, type Status } from '@shared/statuses';

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status]}</span>;
}

export function StatusPicker({
  value,
  onChange,
  label,
}: {
  value: Status;
  onChange: (status: Status) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {statusSchema.options.map((status) => (
        <button
          key={status}
          type="button"
          role="radio"
          aria-checked={value === status}
          className="chip"
          onClick={() => onChange(status)}
        >
          {STATUS_LABELS[status]}
        </button>
      ))}
    </div>
  );
}
