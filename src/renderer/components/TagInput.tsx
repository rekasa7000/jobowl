import { useId, useState } from 'react';

/** A list of short words or phrases. Enter or a comma adds one; each can be removed. */
export function TagInput({
  label,
  values,
  onChange,
  placeholder,
  help,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  help?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState('');
  const add = () => {
    const word = draft.trim().replace(/,$/, '').trim();
    if (word !== '' && !values.some((v) => v.toLowerCase() === word.toLowerCase()))
      onChange([...values, word]);
    setDraft('');
  };
  return (
    <div>
      <label htmlFor={id} className="meta-label field-label">
        {label}
      </label>
      {values.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {values.map((value) => (
            <span key={value} className="chip flex items-center gap-2">
              {value}
              <button
                type="button"
                aria-label={`Remove ${value}`}
                onClick={() => onChange(values.filter((v) => v !== value))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        id={id}
        className="input"
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={add}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            add();
          }
        }}
      />
      {help && <p className="mt-1 text-[0.75rem] text-ink-3">{help}</p>}
    </div>
  );
}
