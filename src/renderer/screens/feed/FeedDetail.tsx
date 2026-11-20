import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router';
import { errorMessage } from '../../lib/applications';
import { evidenceLabels, useJob, useSetJobState } from '../../lib/discovery';
import { useProfile } from '../../lib/profile';
import { ScoreMark } from '../../components/ScoreMark';
import type { FeedContext } from './FeedScreen';

export function EmptyFeedDetail() {
  return (
    <div className="p-8">
      <h2 className="font-display-caps text-[1.75rem]">Pick a job</h2>
      <p className="mt-2 max-w-md text-ink-2">
        Choose one on the left to see why it scored the way it did.
      </p>
      <p className="mt-6 font-mono text-[0.8125rem] text-ink-3">
        ↑ ↓ move · / search · s shortlist · d dismiss
      </p>
    </div>
  );
}

export function FeedDetail() {
  const { id = '' } = useParams();
  const query = useJob(id);
  if (query.isError) {
    return (
      <div className="p-8">
        <h2 className="font-display-caps text-[1.75rem]">Job not found</h2>
        <p className="mt-2 text-ink-2">It may have been removed with its source.</p>
        <Link to="/feed" className="btn-ghost mt-4">
          Back to the feed
        </Link>
      </div>
    );
  }
  if (!query.data) return <p className="p-8 text-ink-3">Loading…</p>;
  return <JobBody key={id} job={query.data} />;
}

function JobBody({ job }: { job: NonNullable<ReturnType<typeof useJob>['data']> }) {
  const navigate = useNavigate();
  const { onDismissed } = useOutletContext<FeedContext>();
  const setState = useSetJobState();
  const profile = useProfile();
  const labels = evidenceLabels(profile.data?.profile);
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState('');
  const best = [...job.matches].sort((a, b) => b.result.score - a.result.score)[0]?.result;

  // s shortlists and d starts a dismissal, unless a field has focus.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      )
        return;
      if (event.key === 's')
        setState.mutate({
          id: job.id,
          state: job.userState === 'shortlisted' ? 'new' : 'shortlisted',
        });
      if (event.key === 'd' && job.userState !== 'dismissed') setDismissing(true);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [job.id, job.userState, setState]);

  function dismiss() {
    const note = reason.trim();
    setState.mutate(
      { id: job.id, state: 'dismissed', ...(note ? { reason: note } : {}) },
      {
        onSuccess: () => {
          onDismissed({ id: job.id, title: job.title });
          void navigate('/feed');
        },
      },
    );
  }

  return (
    <article className="max-w-2xl p-8">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h2 className="font-display-caps break-words text-[2rem]">{job.title}</h2>
          <p className="mt-1 text-ink-2">
            {job.company}
            {job.location ? ` · ${job.location}` : ''}
            {job.remoteMode !== 'unknown' ? ` · ${job.remoteMode}` : ''}
          </p>
          {job.salary && <p className="mt-1 font-mono text-[0.8125rem] text-ink-3">{job.salary}</p>}
        </div>
        <ScoreMark score={job.score} verdict={job.verdict} size="lg" />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {job.userState === 'dismissed' ? (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setState.mutate({ id: job.id, state: 'new' })}
          >
            Move back to the feed
          </button>
        ) : (
          <>
            <button
              type="button"
              className={job.userState === 'shortlisted' ? 'btn-ghost' : 'btn-ink'}
              onClick={() =>
                setState.mutate({
                  id: job.id,
                  state: job.userState === 'shortlisted' ? 'new' : 'shortlisted',
                })
              }
            >
              {job.userState === 'shortlisted' ? 'Shortlisted · undo' : 'Shortlist'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setDismissing(true)}>
              Dismiss
            </button>
          </>
        )}
        <a href={job.url} target="_blank" rel="noreferrer" className="btn-quiet">
          Open posting
        </a>
      </div>
      {setState.isError && (
        <p role="alert" className="field-error">
          {errorMessage(setState.error)}
        </p>
      )}
      {dismissing && (
        <form
          className="panel mt-4 flex flex-col gap-3 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            dismiss();
          }}
        >
          <label className="meta-label field-label">
            Why? (optional, and it helps future scoring)
            <input
              autoFocus
              className="input mt-1.5 font-normal normal-case tracking-normal"
              value={reason}
              placeholder="Agency role"
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <div className="flex gap-3">
            <button type="submit" className="btn-ink">
              Dismiss job
            </button>
            <button type="button" className="btn-ghost" onClick={() => setDismissing(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {job.injectionWarning && (
        <p role="note" className="needs-check mt-5 text-ink-2">
          This posting contains text that reads like an instruction to an AI. jobowl ignores it, but
          read the posting with that in mind.
        </p>
      )}

      {best ? (
        <section aria-labelledby="why-title" className="mt-8 flex flex-col gap-5">
          <h3 id="why-title" className="meta-label">
            Why this score
          </h3>
          <p className="text-[1.0625rem]">{best.summary}</p>
          {best.dealbreakers.length > 0 && (
            <div className="needs-check">
              <p className="meta-label mb-1 text-danger">Dealbreakers</p>
              <ul className="list-disc pl-5">
                {best.dealbreakers.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {best.matched.length > 0 && (
            <div>
              <p className="meta-label field-label">Shown in your profile</p>
              <ul className="flex flex-col gap-3">
                {best.matched.map((item) => (
                  <li key={item.requirement}>
                    <p className="font-semibold">{item.requirement}</p>
                    <ul className="mt-1 flex flex-col gap-1">
                      {item.evidence.map((evidenceId) => (
                        <li
                          key={evidenceId}
                          className="rounded bg-sunken px-2 py-1 font-mono text-[0.75rem] text-ink-2"
                        >
                          {(labels.get(evidenceId) ?? evidenceId).slice(0, 140)}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {best.gaps.length > 0 && (
            <div>
              <p className="meta-label field-label">Not shown</p>
              <ul className="list-disc pl-5">
                {best.gaps.map((gap) => (
                  <li key={gap.requirement}>
                    {gap.requirement}{' '}
                    <span className="font-mono text-[0.75rem] text-ink-3">({gap.severity})</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[0.8125rem] text-ink-3">
                If you do have one of these, add it to your profile and the next run will see it.
              </p>
            </div>
          )}
          {best.seniorityFit !== 'unknown' && (
            <p className="text-ink-2">
              Level:{' '}
              {best.seniorityFit === 'match'
                ? 'matches your experience'
                : best.seniorityFit === 'above'
                  ? 'above your experience'
                  : 'below your experience'}
              .
            </p>
          )}
          {job.matches.length > 1 && (
            <p className="font-mono text-[0.75rem] text-ink-3">
              Scored for{' '}
              {job.matches.map((m) => `${m.searchName} (${String(m.result.score)})`).join(', ')}.
            </p>
          )}
        </section>
      ) : (
        <p className="mt-8 text-ink-2">
          Not scored yet. A score needs a saved profile and a model chosen for the Scorer in
          Settings.
        </p>
      )}

      <section aria-labelledby="posting-title" className="mt-8">
        <h3 id="posting-title" className="meta-label field-label">
          The posting
        </h3>
        <div className="whitespace-pre-wrap break-words text-ink-2">
          {job.description || 'This posting has no description.'}
        </div>
      </section>
    </article>
  );
}
