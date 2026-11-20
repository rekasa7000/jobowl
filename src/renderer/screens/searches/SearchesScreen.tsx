import { useState } from 'react';
import {
  defaultSearch,
  searchFieldsSchema,
  seniorityOptions,
  type Search,
  type SearchFields,
} from '@shared/schemas/discovery';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ScreenHeader } from '../../components/ScreenHeader';
import { TagInput } from '../../components/TagInput';
import { errorMessage } from '../../lib/applications';
import { useDeleteSearch, useSaveSearch, useSearches } from '../../lib/discovery';
import { SelectField, TextField } from '../profile/fields';

const REMOTE_OPTIONS = [
  { value: 'any', label: 'Any' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
] as const;

/** The editable part of a saved search: everything except its id and timestamps. */
function toFields(search: Search): SearchFields {
  return searchFieldsSchema.parse(search);
}

export function SearchesScreen() {
  const searches = useSearches();
  const [selected, setSelected] = useState<string | null>(null);
  const list = searches.data ?? [];
  const current = list.find((s) => s.id === selected);

  return (
    <>
      <ScreenHeader
        title="Searches"
        aside={list.length === 0 ? 'nothing to look for yet' : `${String(list.length)} saved`}
        actions={
          <button type="button" className="btn-ink" onClick={() => setSelected('new')}>
            New search
          </button>
        }
      />
      <div className="flex min-h-0 flex-1">
        <section
          aria-label="Saved searches"
          className="w-[320px] shrink-0 overflow-auto border-r-[1.5px] border-line p-2"
        >
          {list.length === 0 && (
            <div className="p-4">
              <h2 className="font-display-caps text-[1.5rem]">No searches yet</h2>
              <p className="mt-2 text-ink-2">
                A search says which jobs you want. jobowl only scores jobs that fit one.
              </p>
            </div>
          )}
          <ul>
            {list.map((search) => (
              <li key={search.id}>
                <button
                  type="button"
                  className="row-link w-full text-left"
                  aria-current={selected === search.id ? 'page' : undefined}
                  onClick={() => setSelected(search.id)}
                >
                  <span className="block font-semibold">{search.name}</span>
                  <span className="block truncate text-[0.8125rem] text-ink-2">
                    {search.titles.join(', ') || 'Any title'}
                    {search.enabled ? '' : ' · paused'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <main className="min-w-0 flex-1 overflow-auto">
          {selected === null ? (
            <div className="p-8">
              <h2 className="font-display-caps text-[1.75rem]">Pick a search</h2>
              <p className="mt-2 max-w-md text-ink-2">Choose one to edit it, or start a new one.</p>
            </div>
          ) : (
            <SearchForm
              key={selected}
              id={selected === 'new' ? null : selected}
              initial={current ? toFields(current) : defaultSearch()}
              onSaved={setSelected}
              onDeleted={() => setSelected(null)}
            />
          )}
        </main>
      </div>
    </>
  );
}

function SearchForm({
  id,
  initial,
  onSaved,
  onDeleted,
}: {
  id: string | null;
  initial: SearchFields;
  onSaved: (id: string) => void;
  onDeleted: () => void;
}) {
  const [fields, setFields] = useState(initial);
  const [problems, setProblems] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const save = useSaveSearch();
  const remove = useDeleteSearch();
  const set = (next: Partial<SearchFields>) => setFields((f) => ({ ...f, ...next }));

  function submit() {
    const parsed = searchFieldsSchema.safeParse(fields);
    if (!parsed.success) {
      setProblems([...new Set(parsed.error.issues.map((issue) => issue.message))]);
      return;
    }
    setProblems([]);
    save.mutate({ id, fields: parsed.data }, { onSuccess: (saved) => onSaved(saved.id) });
  }

  return (
    <form
      className="flex max-w-2xl flex-col gap-6 p-8"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <h2 className="font-display-caps text-[1.75rem]">
        {id === null ? 'New search' : 'Edit search'}
      </h2>
      <TextField
        label="Name"
        value={fields.name}
        placeholder="Senior frontend, remote"
        onChange={(name) => set({ name })}
      />
      <TagInput
        label="Job titles"
        values={fields.titles}
        onChange={(titles) => set({ titles })}
        placeholder="Frontend Engineer"
        help="Press Enter to add. A job needs a word in common with one of these to be scored."
      />
      <TagInput
        label="Must mention one of"
        values={fields.mustHave}
        onChange={(mustHave) => set({ mustHave })}
        placeholder="React"
      />
      <TagInput
        label="Nice to have"
        values={fields.niceToHave}
        onChange={(niceToHave) => set({ niceToHave })}
        placeholder="GraphQL"
      />
      <TagInput
        label="Leave out jobs mentioning"
        values={fields.excludeWords}
        onChange={(excludeWords) => set({ excludeWords })}
        placeholder="clearance required"
      />
      <TagInput
        label="Leave out companies"
        values={fields.excludeCompanies}
        onChange={(excludeCompanies) => set({ excludeCompanies })}
      />
      <TagInput
        label="Locations"
        values={fields.locations}
        onChange={(locations) => set({ locations })}
        placeholder="Metro Manila"
        help="Checked for on-site and hybrid jobs. Remote jobs are not held to a place."
      />
      <div className="grid grid-cols-2 gap-4">
        <SelectField
          label="Remote"
          value={fields.remoteMode}
          options={REMOTE_OPTIONS}
          onChange={(remoteMode) => remoteMode && set({ remoteMode })}
        />
        <TextField
          label="Newest postings from the last (days)"
          value={String(fields.maxAgeDays)}
          onChange={(value) => set({ maxAgeDays: Number(value) || 0 })}
        />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="meta-label field-label">Seniority</legend>
        <div className="flex flex-wrap gap-4">
          {seniorityOptions.map((level) => (
            <label key={level} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={fields.seniority.includes(level)}
                onChange={(event) =>
                  set({
                    seniority: event.target.checked
                      ? [...fields.seniority, level]
                      : fields.seniority.filter((l) => l !== level),
                  })
                }
              />
              {level}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Salary floor (a year)"
          value={fields.salaryMin === null ? '' : String(fields.salaryMin)}
          help="Jobs that state less are dropped. Jobs that state nothing are kept."
          onChange={(value) =>
            set({ salaryMin: value.trim() === '' ? null : Number(value.replace(/[, ]/g, '')) || 0 })
          }
        />
        <TextField
          label="Currency"
          value={fields.salaryCurrency ?? ''}
          placeholder="USD"
          onChange={(value) =>
            set({ salaryCurrency: value.trim() === '' ? null : value.trim().toUpperCase() })
          }
        />
      </div>
      <TextField
        label="Notify me at a score of"
        value={String(fields.minScoreNotify)}
        onChange={(value) => set({ minScoreNotify: Number(value) || 0 })}
        help="A Windows notification for new matches at or above this."
      />
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={fields.enabled}
          onChange={(event) => set({ enabled: event.target.checked })}
        />
        Use this search in runs
      </label>

      {problems.length > 0 && (
        <ul role="alert" className="list-disc pl-5 text-danger">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      {save.isError && (
        <p role="alert" className="field-error">
          Couldn't save: {errorMessage(save.error)}
        </p>
      )}
      <div className="flex gap-3">
        <button type="submit" className="btn-ink" disabled={save.isPending}>
          {id === null ? 'Create search' : 'Save changes'}
        </button>
        {id !== null && (
          <button type="button" className="btn-danger" onClick={() => setConfirming(true)}>
            Delete search
          </button>
        )}
      </div>
      <ConfirmDialog
        open={confirming}
        title="Delete this search?"
        description={`"${fields.name}" and the scores it produced will be removed. Jobs stay in your feed if another search matches them.`}
        confirmLabel="Delete search"
        cancelLabel="Keep it"
        busy={remove.isPending}
        error={remove.isError ? errorMessage(remove.error) : null}
        onOpenChange={setConfirming}
        onConfirm={() => {
          if (id !== null) remove.mutate(id, { onSuccess: onDeleted });
        }}
      />
    </form>
  );
}
