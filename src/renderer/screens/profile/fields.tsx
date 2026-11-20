import { useId, type ReactNode } from 'react';

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  help,
  multiline = false,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  help?: string;
  multiline?: boolean;
  rows?: number;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="meta-label field-label">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          className="input"
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          className="input"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {help && <p className="mt-1 text-[0.75rem] text-ink-3">{help}</p>}
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | '';
  options: readonly { value: T | ''; label: string }[];
  onChange: (next: T | '') => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="meta-label field-label">
        {label}
      </label>
      <select
        id={id}
        className="input"
        value={value}
        onChange={(event) => onChange(event.target.value as T | '')}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** A collapsible block of the profile. Open by default: this is a long form to scan. */
export function Section({
  title,
  count,
  children,
  actions,
}: {
  title: string;
  count?: number;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <details open className="panel">
      <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4">
        <span className="flex items-baseline gap-3">
          <h2 className="font-display-caps text-[1.5rem]">{title}</h2>
          {count !== undefined && (
            <span className="font-mono text-[0.8125rem] text-ink-3">{count}</span>
          )}
        </span>
      </summary>
      <div className="flex flex-col gap-5 border-t border-dashed border-line px-5 py-5">
        {children}
        {actions}
      </div>
    </details>
  );
}

/** Marks an item the import couldn't match to the resume text, so it gets looked at first. */
export function Checked({ flagged, children }: { flagged: boolean; children: ReactNode }) {
  return (
    <div className={flagged ? 'needs-check' : undefined}>
      {flagged && <p className="meta-label mb-2 text-danger">Check this against your resume</p>}
      {children}
    </div>
  );
}

export function replaceAt<T>(items: readonly T[], index: number, next: T): T[] {
  return items.map((item, i) => (i === index ? next : item));
}

export function removeAt<T>(items: readonly T[], index: number): T[] {
  return items.filter((_, i) => i !== index);
}

/** Sets an optional text field, removing it entirely when emptied (the profile has no empty strings for these). */
export function setOptional<T extends object>(item: T, key: keyof T & string, value: string): T {
  const kept = Object.entries(item).filter(([name]) => name !== key) as [string, unknown][];
  return Object.fromEntries(value === '' ? kept : [...kept, [key, value]]) as T;
}
