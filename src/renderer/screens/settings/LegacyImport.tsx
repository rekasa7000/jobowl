import { useState } from 'react';
import { errorMessage, useLegacyDetect, useLegacyImport } from '../../lib/applications';

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function LegacyImport() {
  const detect = useLegacyDetect();
  const run = useLegacyImport();
  const [skipSamples, setSkipSamples] = useState(true);
  const info = detect.data;

  const fresh = info ? info.total - info.alreadyImported : 0;
  const willImport = info ? fresh - (skipSamples ? info.samples : 0) : 0;
  const result = run.data;

  return (
    <section aria-labelledby="legacy-title" className="flex flex-col gap-3">
      <h2 id="legacy-title" className="meta-label">
        Import from jobowl 0.1
      </h2>

      {detect.isError ? (
        <p role="alert" className="text-danger">
          Couldn't look for jobowl 0.1 data: {errorMessage(detect.error)}
        </p>
      ) : !info ? (
        <p className="text-ink-3">Looking for jobowl 0.1 data…</p>
      ) : !info.found ? (
        <p className="text-ink-2">
          No jobowl 0.1 data found. It would be at{' '}
          <span className="break-all font-mono text-[0.8125rem]">{info.path}</span>.
        </p>
      ) : info.error ? (
        <p role="alert" className="text-danger">
          Found {info.path} but couldn't read it. {info.error}
        </p>
      ) : (
        <>
          <p className="text-ink-2">
            Found {plural(info.total, 'application', 'applications')} from jobowl 0.1
            {info.alreadyImported > 0 ? `, ${info.alreadyImported} already imported` : ''}. Your old
            file isn't changed.
          </p>

          {info.samples > 0 && (
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={skipSamples}
                onChange={(event) => setSkipSamples(event.target.checked)}
              />
              <span>
                Skip the {info.samples} sample {info.samples === 1 ? 'entry' : 'entries'} jobowl 0.1
                added on first launch (Google, Microsoft, Apple)
              </span>
            </label>
          )}

          {willImport > 0 && (
            <div>
              <button
                type="button"
                className="btn-ink"
                disabled={run.isPending}
                onClick={() => run.mutate(!skipSamples)}
              >
                Import {plural(willImport, 'application', 'applications')}
              </button>
            </div>
          )}
        </>
      )}

      {run.isError && (
        <p role="alert" className="text-danger">
          The import failed and nothing was added. {errorMessage(run.error)}
        </p>
      )}
      {result && (
        <p role="status" className="text-ink-2">
          Imported {plural(result.imported, 'application', 'applications')}.
          {result.skippedSamples > 0 &&
            ` Skipped ${plural(result.skippedSamples, 'sample entry', 'sample entries')}.`}
          {result.unknownStatus > 0 &&
            ` ${plural(result.unknownStatus, 'entry', 'entries')} had an unrecognised status and ${result.unknownStatus === 1 ? 'was' : 'were'} set to Applied.`}
        </p>
      )}
    </section>
  );
}
