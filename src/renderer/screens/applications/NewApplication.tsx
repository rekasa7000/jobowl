import { useState, type SyntheticEvent } from 'react';
import { useNavigate } from 'react-router';
import type { Status } from '@shared/statuses';
import { StatusPicker } from '../../components/StatusBadge';
import { errorMessage, localToday, useCreateApplication } from '../../lib/applications';

export function NewApplication() {
  const navigate = useNavigate();
  const create = useCreateApplication();
  const [company, setCompany] = useState('');
  const [position, setPosition] = useState('');
  const [date, setDate] = useState(localToday());
  const [status, setStatus] = useState<Status>('applied');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ company?: string; position?: string; form?: string }>({});

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    if (company.trim() === '') next.company = 'Enter the company name.';
    if (position.trim() === '') next.position = 'Enter the position.';
    setErrors(next);
    if (next.company || next.position) return;

    try {
      const detail = await create.mutateAsync({
        company,
        position,
        status,
        dateApplied: date === '' ? null : date,
        notes,
      });
      void navigate(`/applications/${detail.application.id}`);
    } catch (caught) {
      setErrors({ form: errorMessage(caught) });
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="max-w-xl p-8">
      <h2 className="font-display-caps text-[1.75rem]">New application</h2>
      <p className="mt-1 text-ink-2">For something you applied to outside jobowl.</p>

      <div className="mt-6 flex flex-col gap-5">
        <div>
          <label htmlFor="new-company" className="meta-label field-label">
            Company
          </label>
          <input
            id="new-company"
            className="input"
            autoFocus
            value={company}
            aria-invalid={errors.company !== undefined}
            aria-describedby={errors.company ? 'new-company-error' : undefined}
            onChange={(event) => setCompany(event.target.value)}
          />
          {errors.company && (
            <p id="new-company-error" role="alert" className="field-error">
              {errors.company}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="new-position" className="meta-label field-label">
            Position
          </label>
          <input
            id="new-position"
            className="input"
            value={position}
            aria-invalid={errors.position !== undefined}
            aria-describedby={errors.position ? 'new-position-error' : undefined}
            onChange={(event) => setPosition(event.target.value)}
          />
          {errors.position && (
            <p id="new-position-error" role="alert" className="field-error">
              {errors.position}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="new-date" className="meta-label field-label">
            Date applied
          </label>
          <input
            id="new-date"
            type="date"
            className="input"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
        <div>
          <span className="meta-label field-label">Status</span>
          <StatusPicker value={status} onChange={setStatus} label="Status" />
        </div>
        <div>
          <label htmlFor="new-notes" className="meta-label field-label">
            Notes
          </label>
          <textarea
            id="new-notes"
            className="input"
            rows={5}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
      </div>

      {errors.form && (
        <p role="alert" className="field-error">
          {errors.form}
        </p>
      )}

      <div className="mt-8 flex gap-3">
        <button type="submit" className="btn-ink" disabled={create.isPending}>
          Add application
        </button>
        <button type="button" className="btn-ghost" onClick={() => void navigate('/applications')}>
          Cancel
        </button>
      </div>
    </form>
  );
}
