import { useState } from 'react';
import {
  ACTIVE_LAYERS,
  LAYER_LABELS,
  PROVIDER_LABELS,
  providerIdSchema,
  type AiSettings as AiSettingsValue,
  type KeyProvider,
  type ProviderId,
} from '@shared/schemas/ai';
import {
  useAiStatus,
  useClearKey,
  useLoadModels,
  useSetKey,
  useSpend,
  useTestModel,
} from '../../lib/ai';
import { errorMessage } from '../../lib/applications';
import { useSettings, useUpdateSettings } from '../../lib/ipc';

function usd(value: number): string {
  return `$${value.toFixed(value < 1 ? 4 : 2)}`;
}

function KeyField({
  provider,
  hint,
  disabled,
}: {
  provider: KeyProvider;
  hint: string | null;
  disabled: boolean;
}) {
  const [key, setKey] = useState('');
  const setKeyMutation = useSetKey();
  const clear = useClearKey();
  const error = setKeyMutation.error ?? clear.error;
  const id = `key-${provider}`;

  return (
    <div>
      <label htmlFor={id} className="meta-label field-label">
        {PROVIDER_LABELS[provider]} API key{provider === 'openai_compatible' ? ' (optional)' : ''}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type="password"
          autoComplete="off"
          className="input"
          disabled={disabled}
          placeholder={hint ? `Saved, ends in ${hint}` : 'Paste your key'}
          value={key}
          onChange={(event) => setKey(event.target.value)}
        />
        <button
          type="button"
          className="btn-ghost"
          disabled={disabled || key.trim() === '' || setKeyMutation.isPending}
          onClick={() => setKeyMutation.mutate({ provider, key }, { onSuccess: () => setKey('') })}
        >
          Save key
        </button>
        {hint && (
          <button type="button" className="btn-quiet" onClick={() => clear.mutate(provider)}>
            Remove
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="field-error">
          {errorMessage(error)}
        </p>
      )}
    </div>
  );
}

function UrlField({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder: string;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const bad = draft !== '' && !/^https?:\/\//.test(draft);
  return (
    <div>
      <label className="meta-label field-label">
        {label}
        <input
          className="input mt-1.5 font-normal normal-case tracking-normal"
          value={draft}
          placeholder={placeholder}
          aria-invalid={bad}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (!bad && draft !== value) onCommit(draft);
          }}
        />
      </label>
      {bad && <p className="field-error">Start with http:// or https://</p>}
    </div>
  );
}

export function AiSettings() {
  const settings = useSettings();
  const update = useUpdateSettings();
  const status = useAiStatus();
  const spend = useSpend();
  const loadModels = useLoadModels();
  const test = useTestModel();

  if (!settings.data || !status.data) return <p className="text-ink-3">Loading AI settings…</p>;
  const ai = settings.data.ai;
  const save = (next: AiSettingsValue) => update.mutate({ ai: next });
  const parser = ai.layers.parser;
  const ready = status.data.providers
    .filter((provider) => provider.ready)
    .map((provider) => provider.id);
  const hint = (id: ProviderId) =>
    status.data.providers.find((provider) => provider.id === id)?.keyHint ?? null;

  function choose(next: { provider: ProviderId; model: string }) {
    test.reset();
    save({ ...ai, layers: { ...ai.layers, parser: next } });
  }

  return (
    <section aria-labelledby="ai-title" className="flex flex-col gap-5">
      <h2 id="ai-title" className="meta-label">
        AI
      </h2>
      <p className="text-ink-2">
        jobowl reads your resume with an AI model: one running on this PC through Ollama, or a cloud
        model with your own key. Your resume text is sent only to the provider you pick for the
        step.
      </p>

      {!status.data.secretsAvailable && (
        <p role="alert" className="field-error">
          Windows can't encrypt secrets for this account, so jobowl won't save API keys. Ollama
          still works, because it needs none.
        </p>
      )}

      <KeyField
        provider="anthropic"
        hint={hint('anthropic')}
        disabled={!status.data.secretsAvailable}
      />
      <KeyField provider="openai" hint={hint('openai')} disabled={!status.data.secretsAvailable} />
      <UrlField
        label="Ollama address"
        value={ai.ollamaUrl}
        placeholder="http://127.0.0.1:11434"
        onCommit={(ollamaUrl) => save({ ...ai, ollamaUrl })}
      />
      <UrlField
        label="OpenAI-compatible server address"
        value={ai.compatibleUrl}
        placeholder="http://127.0.0.1:1234/v1"
        onCommit={(compatibleUrl) => save({ ...ai, compatibleUrl })}
      />
      <KeyField
        provider="openai_compatible"
        hint={hint('openai_compatible')}
        disabled={!status.data.secretsAvailable}
      />

      {ACTIVE_LAYERS.map((layer) => (
        <fieldset key={layer} className="panel flex flex-col gap-3 p-5">
          <legend className="meta-label px-2">
            {LAYER_LABELS[layer].name}: {LAYER_LABELS[layer].job.toLowerCase()}
          </legend>
          <div className="grid grid-cols-[12rem_1fr] gap-3">
            <div>
              <label htmlFor="parser-provider" className="meta-label field-label">
                Provider
              </label>
              <select
                id="parser-provider"
                className="input"
                value={parser?.provider ?? ''}
                onChange={(event) =>
                  choose({ provider: providerIdSchema.parse(event.target.value), model: '' })
                }
              >
                <option value="" disabled>
                  Choose…
                </option>
                {providerIdSchema.options.map((id) => (
                  <option key={id} value={id} disabled={!ready.includes(id)}>
                    {PROVIDER_LABELS[id]}
                    {ready.includes(id) ? '' : ' (not set up)'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="parser-model" className="meta-label field-label">
                Model
              </label>
              <input
                id="parser-model"
                className="input"
                list="parser-models"
                disabled={!parser}
                placeholder={parser?.provider === 'anthropic' ? 'claude-opus-5-5' : 'Model name'}
                value={parser?.model ?? ''}
                onChange={(event) =>
                  parser && choose({ provider: parser.provider, model: event.target.value })
                }
              />
              <datalist id="parser-models">
                {loadModels.data?.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </datalist>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-ghost"
              disabled={!parser || loadModels.isPending}
              onClick={() => parser && loadModels.mutate(parser.provider)}
            >
              {loadModels.isPending ? 'Loading…' : 'Load model list'}
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={!parser || parser.model === '' || test.isPending}
              onClick={() => parser && test.mutate(parser)}
            >
              {test.isPending ? 'Testing…' : 'Test this model'}
            </button>
            <span role="status" className="font-mono text-[0.8125rem]">
              {test.data?.ok && (
                <span className="text-signal">Works · {(test.data.ms / 1000).toFixed(1)} s</span>
              )}
              {test.data && !test.data.ok && (
                <span className="text-danger">Failed: {test.data.error}</span>
              )}
              {loadModels.data && !test.data && `${loadModels.data.length} models found`}
            </span>
          </div>
          {loadModels.isError && (
            <p role="alert" className="field-error">
              Couldn't load models: {errorMessage(loadModels.error)}
            </p>
          )}
        </fieldset>
      ))}

      <p className="font-mono text-[0.8125rem] text-ink-2" role="status">
        {spend.data
          ? `This month: ${usd(spend.data.monthUsd)} across ${String(spend.data.calls)} ${spend.data.calls === 1 ? 'call' : 'calls'}` +
            (spend.data.unpriced > 0
              ? `, plus ${String(spend.data.unpriced)} to models with no known price`
              : '')
          : ''}
      </p>
    </section>
  );
}
