import { useSettings, useUpdateSettings } from '../../lib/ipc';

const INTERVALS = [1, 3, 6, 12, 24, 48];

export function RunSettings() {
  const settings = useSettings();
  const update = useUpdateSettings();
  if (!settings.data) return null;
  const runs = settings.data.runs;
  const cap = settings.data.ai.monthlyCapUsd;

  return (
    <section aria-labelledby="runs-title" className="flex flex-col gap-4">
      <h2 id="runs-title" className="meta-label">
        Runs
      </h2>
      <p className="max-w-xl text-ink-2">
        A run fetches your sources and scores what fits your searches. It starts when jobowl opens
        if one is due, and then on this schedule while it stays open.
      </p>
      <label className="flex max-w-xs flex-col gap-1.5">
        <span className="meta-label">Run every</span>
        <select
          className="input"
          value={runs.intervalHours}
          onChange={(event) =>
            update.mutate({ runs: { ...runs, intervalHours: Number(event.target.value) } })
          }
        >
          {INTERVALS.map((hours) => (
            <option key={hours} value={hours}>
              {hours === 1 ? 'hour' : `${String(hours)} hours`}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={runs.startWithWindows}
          onChange={(event) =>
            update.mutate({ runs: { ...runs, startWithWindows: event.target.checked } })
          }
        />
        Start jobowl when I sign in to Windows
      </label>
      <label className="flex max-w-xs flex-col gap-1.5">
        <span className="meta-label">Monthly AI limit (USD)</span>
        <input
          type="number"
          min={0}
          className="input"
          defaultValue={cap}
          onBlur={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next) && next >= 0 && next !== cap)
              update.mutate({ ai: { ...settings.data.ai, monthlyCapUsd: next } });
          }}
        />
        <span className="text-[0.75rem] text-ink-3">
          Scoring stops when this month's estimated spend reaches it. 0 means no limit. Models on
          your own PC cost nothing.
        </span>
      </label>
    </section>
  );
}
