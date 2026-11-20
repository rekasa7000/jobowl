import { Readout } from '../../components/Readout';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ThemeSwitch } from '../../components/ThemeSwitch';
import { useAppInfo, useSettings, useUpdateSettings } from '../../lib/ipc';
import { AiSettings } from './AiSettings';
import { LegacyImport } from './LegacyImport';
import { RunSettings } from './RunSettings';

export function SettingsScreen() {
  const settings = useSettings();
  const info = useAppInfo();
  const update = useUpdateSettings();

  return (
    <>
      <ScreenHeader title="Settings" />
      <main className="flex-1 overflow-auto p-8">
        <div className="flex max-w-xl flex-col gap-10">
          <section aria-labelledby="appearance-title" className="flex flex-col gap-3">
            <h2 id="appearance-title" className="meta-label">
              Appearance
            </h2>
            {settings.data && (
              <ThemeSwitch
                value={settings.data.theme}
                onChange={(theme) => update.mutate({ theme })}
              />
            )}
          </section>

          <RunSettings />

          <AiSettings />

          <LegacyImport />

          <section aria-labelledby="install-title" className="flex flex-col gap-3">
            <h2 id="install-title" className="meta-label">
              This install
            </h2>
            {info.isError ? (
              <p role="alert" className="text-danger">
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
    </>
  );
}
