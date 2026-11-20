import { Rail } from '../components/Rail';
import { ThemeSwitch } from '../components/ThemeSwitch';
import { useAppInfo, useSettings, useUpdateSettings } from '../lib/ipc';
import { useApplyTheme } from '../lib/theme';

function Readout({ rows }: { rows: [label: string, value: string][] }) {
  return (
    <dl className="panel w-full max-w-xl">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="readout-row flex items-baseline justify-between gap-6 px-5 py-3"
        >
          <dt className="meta-label">{label}</dt>
          <dd className="break-all text-right font-mono text-[0.8125rem]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function App() {
  const settings = useSettings();
  const info = useAppInfo();
  const update = useUpdateSettings();
  const theme = settings.data?.theme;

  useApplyTheme(theme);

  return (
    <div className="flex h-full">
      <Rail />
      <main id="home" className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b-[1.5px] border-line px-8 py-5">
          <div className="flex items-baseline gap-4">
            <h1 className="font-display-caps text-[3.5rem]">Home</h1>
            <span className="font-accent text-lg italic text-ink-2">nothing to track yet</span>
          </div>
          {theme && (
            <ThemeSwitch value={theme} onChange={(next) => update.mutate({ theme: next })} />
          )}
        </header>

        <div className="flex flex-1 flex-col gap-8 overflow-auto p-8">
          <section aria-labelledby="empty-title">
            <h2 id="empty-title" className="font-display-caps text-[1.75rem]">
              No applications yet
            </h2>
            <p className="mt-2 max-w-xl text-ink-2">
              The tracker, profile and job feed arrive in the next releases. Your data folder and
              database are already set up.
            </p>
          </section>

          <section aria-labelledby="status-title" className="flex flex-col gap-3">
            <h2 id="status-title" className="meta-label">
              This install
            </h2>
            {info.isError ? (
              <p role="alert" className="max-w-xl text-danger">
                Couldn't read app details. Restart jobowl; if this keeps happening, check the log
                folder in your data directory.
              </p>
            ) : info.data ? (
              <Readout
                rows={[
                  ['Version', info.data.version],
                  ['Database schema', `v${info.data.schemaVersion}`],
                  ['Data folder', info.data.dataDir],
                  ['Platform', info.data.platform],
                ]}
              />
            ) : (
              <p className="text-ink-3">Reading app details…</p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
