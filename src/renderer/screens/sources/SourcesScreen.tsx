import { useState } from 'react';
import { SOURCE_LABELS, type Source } from '@shared/schemas/discovery';
import { ScreenHeader } from '../../components/ScreenHeader';
import { errorMessage } from '../../lib/applications';
import {
  useAddSource,
  useAdzunaKey,
  useDeleteSource,
  useDetectSource,
  useSources,
  useUpdateSource,
} from '../../lib/discovery';

const STATUS_TEXT: Record<NonNullable<Source['lastStatus']>, string> = {
  ok: 'Working',
  error: 'Problem',
  rate_limited: 'Asked to slow down',
  blocked: 'Blocked by the site',
};

function when(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : 'not run yet';
}

export function SourcesScreen() {
  const sources = useSources();
  const update = useUpdateSource();
  const remove = useDeleteSource();
  const list = sources.data ?? [];

  return (
    <>
      <ScreenHeader
        title="Sources"
        aside={list.length === 0 ? 'nowhere to look yet' : `${String(list.length)} added`}
      />
      <main className="flex-1 overflow-auto p-8">
        <div className="flex max-w-3xl flex-col gap-10">
          <section aria-labelledby="added-title">
            <h2 id="added-title" className="meta-label field-label">
              Where jobs come from
            </h2>
            {list.length === 0 ? (
              <p className="max-w-xl text-ink-2">
                Add a company's job board, or one of the remote job feeds below. jobowl reads each
                one's public listings and nothing else.
              </p>
            ) : (
              <ul className="panel">
                {list.map((source) => (
                  <li
                    key={source.id}
                    className="readout-row flex items-start justify-between gap-4 px-5 py-4"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">{source.label}</p>
                      <p className="text-[0.8125rem] text-ink-2">
                        {SOURCE_LABELS[source.type]}
                        {Object.keys(source.config).length > 0
                          ? ` · ${Object.values(source.config).join(' · ')}`
                          : ''}
                      </p>
                      <p className="mt-1 font-mono text-[0.75rem] text-ink-3">
                        {source.lastStatus ? STATUS_TEXT[source.lastStatus] : 'Not run yet'} ·{' '}
                        {when(source.lastRunAt)}
                      </p>
                      {source.lastError && (
                        <p role="status" className="mt-1 text-[0.8125rem] text-danger">
                          {source.lastError}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <label className="flex items-center gap-2 text-[0.8125rem]">
                        <input
                          type="checkbox"
                          checked={source.enabled}
                          aria-label={`Use ${source.label}`}
                          onChange={(event) =>
                            update.mutate({
                              id: source.id,
                              patch: { enabled: event.target.checked },
                            })
                          }
                        />
                        Use
                      </label>
                      <button
                        type="button"
                        className="btn-quiet"
                        aria-label={`Remove ${source.label}`}
                        onClick={() => remove.mutate(source.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <AddBoard />
          <AddFeeds existing={list} />
        </div>
      </main>
    </>
  );
}

function AddBoard() {
  const detect = useDetectSource();
  const add = useAddSource();
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const found = detect.data;

  return (
    <section aria-labelledby="board-title" className="flex flex-col gap-3">
      <h2 id="board-title" className="meta-label">
        Add a company's job board
      </h2>
      <p className="max-w-xl text-ink-2">
        Paste the address of a company's careers page on Greenhouse, Lever or Ashby, such as
        boards.greenhouse.io/acme.
      </p>
      <form
        className="flex max-w-xl gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          add.reset();
          detect.mutate(url, { onSuccess: (result) => setLabel(result?.label ?? '') });
        }}
      >
        <input
          className="input"
          aria-label="Job board address"
          placeholder="https://boards.greenhouse.io/acme"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
        <button
          type="submit"
          className="btn-ghost"
          disabled={url.trim() === '' || detect.isPending}
        >
          Check address
        </button>
      </form>
      {detect.isSuccess && found === null && (
        <p role="status" className="max-w-xl text-ink-2">
          jobowl can't read that address. It reads Greenhouse, Lever and Ashby boards. Sites like
          LinkedIn and Indeed don't allow automated access, so jobowl doesn't use them.
        </p>
      )}
      {found && (
        <div className="panel flex max-w-xl flex-col gap-3 p-5">
          <p>
            Found a <strong>{SOURCE_LABELS[found.type]}</strong> (
            {Object.values(found.config).join(', ')}).
          </p>
          <label className="meta-label field-label">
            Show it as
            <input
              className="input mt-1.5 font-normal normal-case tracking-normal"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          <p className="text-[0.8125rem] text-ink-3">
            Jobs from this board are listed under this company name.
          </p>
          <div>
            <button
              type="button"
              className="btn-ink"
              disabled={add.isPending}
              onClick={() =>
                add.mutate(
                  { type: found.type, config: found.config, label },
                  {
                    onSuccess: () => {
                      setUrl('');
                      detect.reset();
                    },
                  },
                )
              }
            >
              Add this board
            </button>
          </div>
        </div>
      )}
      {(detect.isError || add.isError) && (
        <p role="alert" className="field-error">
          {errorMessage(detect.error ?? add.error)}
        </p>
      )}
    </section>
  );
}

function AddFeeds({ existing }: { existing: Source[] }) {
  const add = useAddSource();
  const adzuna = useAdzunaKey();
  const [country, setCountry] = useState('gb');
  const [appId, setAppId] = useState('');
  const [key, setKey] = useState('');
  const has = (type: Source['type']) => existing.some((s) => s.type === type);
  const FEEDS = [
    { type: 'remotive', label: 'Remotive', note: 'Remote jobs, searched by your job titles.' },
    {
      type: 'remoteok',
      label: 'RemoteOK',
      note: 'Remote jobs. Links back to RemoteOK for each posting.',
    },
    { type: 'arbeitnow', label: 'Arbeitnow', note: 'Jobs mostly in Germany and across Europe.' },
  ] as const;

  return (
    <section aria-labelledby="feeds-title" className="flex flex-col gap-4">
      <h2 id="feeds-title" className="meta-label">
        Job feeds
      </h2>
      <ul className="flex max-w-xl flex-col gap-3">
        {FEEDS.map((feed) => (
          <li key={feed.type} className="flex items-center justify-between gap-4">
            <span>
              <span className="font-semibold">{feed.label}</span>
              <span className="block text-[0.8125rem] text-ink-2">{feed.note}</span>
            </span>
            <button
              type="button"
              className="btn-ghost"
              disabled={has(feed.type) || add.isPending}
              onClick={() => add.mutate({ type: feed.type, config: {}, label: feed.label })}
            >
              {has(feed.type) ? 'Added' : `Add ${feed.label}`}
            </button>
          </li>
        ))}
      </ul>

      <fieldset className="panel flex max-w-xl flex-col gap-3 p-5">
        <legend className="meta-label px-2">Adzuna</legend>
        <p className="text-ink-2">
          Searches many boards at once. Needs a free app id and key from Adzuna's developer site.
        </p>
        <div className="grid grid-cols-[6rem_1fr] gap-3">
          <label className="meta-label field-label">
            Country
            <input
              className="input mt-1.5 font-normal normal-case tracking-normal"
              value={country}
              maxLength={2}
              onChange={(event) => setCountry(event.target.value.toLowerCase())}
            />
          </label>
          <label className="meta-label field-label">
            App id
            <input
              className="input mt-1.5 font-normal normal-case tracking-normal"
              value={appId}
              onChange={(event) => setAppId(event.target.value)}
            />
          </label>
        </div>
        <label className="meta-label field-label">
          App key
          <div className="mt-1.5 flex gap-2">
            <input
              type="password"
              autoComplete="off"
              className="input font-normal normal-case tracking-normal"
              placeholder={
                adzuna.status.data?.adzunaKeyHint
                  ? `Saved, ends in ${adzuna.status.data.adzunaKeyHint}`
                  : 'Paste your key'
              }
              value={key}
              onChange={(event) => setKey(event.target.value)}
            />
            <button
              type="button"
              className="btn-ghost"
              disabled={key.trim() === '' || adzuna.set.isPending}
              onClick={() => adzuna.set.mutate(key, { onSuccess: () => setKey('') })}
            >
              Save key
            </button>
          </div>
        </label>
        <div>
          <button
            type="button"
            className="btn-ink"
            disabled={appId.trim() === '' || has('adzuna') || add.isPending}
            onClick={() =>
              add.mutate({
                type: 'adzuna',
                config: { country, appId: appId.trim() },
                label: `Adzuna (${country.toUpperCase()})`,
              })
            }
          >
            {has('adzuna') ? 'Added' : 'Add Adzuna'}
          </button>
        </div>
        {adzuna.set.isError && (
          <p role="alert" className="field-error">
            {errorMessage(adzuna.set.error)}
          </p>
        )}
      </fieldset>
      {add.isError && (
        <p role="alert" className="field-error">
          {errorMessage(add.error)}
        </p>
      )}
    </section>
  );
}
