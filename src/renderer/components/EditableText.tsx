import { useEffect, useId, useState } from 'react';
import { errorMessage } from '../lib/applications';

interface Props {
  label: string;
  value: string;
  multiline?: boolean;
  rows?: number;
  type?: 'text' | 'date';
  /** Saves the new value. Reject with an Error to show its message and keep the draft. */
  onCommit: (next: string) => Promise<unknown>;
}

/** Saves when the field loses focus (or on Enter for single-line fields), so nothing is lost by navigating away. */
export function EditableText({
  label,
  value,
  multiline = false,
  rows = 6,
  type = 'text',
  onCommit,
}: Props) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);

  // The saved value can differ from what was typed (for example, trimmed), so follow it.
  useEffect(() => setDraft(value), [value]);

  async function commit() {
    if (draft === value) {
      setError(null);
      return;
    }
    try {
      await onCommit(draft);
      setError(null);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  const shared = {
    id,
    className: 'input',
    value: draft,
    'aria-invalid': error !== null,
    'aria-describedby': error ? `${id}-error` : undefined,
    onBlur: () => void commit(),
  };

  return (
    <div>
      <label htmlFor={id} className="meta-label field-label">
        {label}
      </label>
      {multiline ? (
        <textarea {...shared} rows={rows} onChange={(event) => setDraft(event.target.value)} />
      ) : (
        <input
          {...shared}
          type={type}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
