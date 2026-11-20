import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { ApplicationDetail as Detail } from '@shared/schemas/application';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EditableText } from '../../components/EditableText';
import { StatusPicker } from '../../components/StatusBadge';
import { Timeline } from '../../components/Timeline';
import {
  errorMessage,
  useApplication,
  useDeleteApplication,
  useUpdateApplication,
} from '../../lib/applications';

export function ApplicationDetail() {
  const { id = '' } = useParams();
  const query = useApplication(id);

  if (query.isError) {
    return (
      <div className="p-8">
        <h2 className="font-display-caps text-[1.75rem]">Application not found</h2>
        <p className="mt-2 text-ink-2">It may have been deleted.</p>
        <Link to="/applications" className="btn-ghost mt-4">
          Back to the list
        </Link>
      </div>
    );
  }
  if (!query.data) return <p className="p-8 text-ink-3">Loading…</p>;

  // Keyed by id so switching applications starts every field from the saved values.
  return <DetailBody key={id} detail={query.data} />;
}

function DetailBody({ detail }: { detail: Detail }) {
  const { application, events } = detail;
  const navigate = useNavigate();
  const update = useUpdateApplication(application.id);
  const remove = useDeleteApplication();
  const [confirming, setConfirming] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  return (
    <article className="max-w-2xl p-8">
      <div className="min-w-0">
        <h2 className="font-display-caps break-words text-[2rem]">{application.company}</h2>
        <p className="mt-1 text-ink-2">{application.position}</p>
      </div>

      <p role="status" className="mt-2 h-5 font-mono text-[0.75rem] text-ink-3">
        {update.isPending ? 'Saving…' : update.isSuccess ? 'Saved' : ''}
      </p>

      <div className="mt-4 flex flex-col gap-6">
        <div>
          <span className="meta-label field-label">Status</span>
          <StatusPicker
            label="Status"
            value={application.status}
            onChange={(status) => {
              setStatusError(null);
              update.mutateAsync({ status }).catch((caught: unknown) => {
                setStatusError(errorMessage(caught));
              });
            }}
          />
          {statusError && (
            <p role="alert" className="field-error">
              {statusError}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <EditableText
            label="Company"
            value={application.company}
            onCommit={(company) => update.mutateAsync({ company })}
          />
          <EditableText
            label="Position"
            value={application.position}
            onCommit={(position) => update.mutateAsync({ position })}
          />
        </div>

        <div className="max-w-[14rem]">
          <EditableText
            label="Date applied"
            type="date"
            value={application.dateApplied ?? ''}
            onCommit={(date) => update.mutateAsync({ dateApplied: date === '' ? null : date })}
          />
        </div>

        <EditableText
          label="Notes"
          multiline
          rows={7}
          value={application.notes}
          onCommit={(notes) => update.mutateAsync({ notes })}
        />

        <section aria-labelledby="history-title">
          <h3 id="history-title" className="meta-label field-label">
            Activity
          </h3>
          <Timeline events={events} />
        </section>

        <div>
          <button type="button" className="btn-danger" onClick={() => setConfirming(true)}>
            Delete application
          </button>
        </div>
      </div>

      <ConfirmDialog
        title="Delete this application?"
        description={`${application.company} · ${application.position} and its history will be removed. This can't be undone.`}
        confirmLabel="Delete application"
        cancelLabel="Keep it"
        open={confirming}
        busy={remove.isPending}
        error={remove.isError ? errorMessage(remove.error) : null}
        onOpenChange={setConfirming}
        onConfirm={() => {
          remove
            .mutateAsync(application.id)
            .then(() => navigate('/applications'))
            .catch(() => undefined);
        }}
      />
    </article>
  );
}
