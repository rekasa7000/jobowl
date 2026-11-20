import { useState } from 'react';
import { Link } from 'react-router';
import { ZodError } from 'zod';
import { emptyProfile, profileSchema, type DraftProfile } from '@shared/schemas/profile';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ScreenHeader } from '../../components/ScreenHeader';
import { errorMessage } from '../../lib/applications';
import {
  useImportFile,
  useImportText,
  useProfile,
  useProfileVersions,
  useSaveProfile,
} from '../../lib/profile';
import { isDirty, useWorkspace, workingFromImport } from '../../lib/workspace';
import {
  AnswersSection,
  CertificationsSection,
  EducationSection,
  ExperienceSection,
  PersonSection,
  ProjectsSection,
  SamplesSection,
  SkillsSection,
  SummarySection,
} from './sections';

const SECTION_NAMES: Record<string, string> = {
  person: 'You',
  summary: 'Summary',
  experiences: 'Experience',
  projects: 'Projects',
  education: 'Education',
  certifications: 'Certifications',
  skills: 'Skills',
  standardAnswers: 'Standard answers',
  writingSamples: 'Writing samples',
};

/** Turns schema failures into lines like "Experience 2: Employer is required". */
function describe(error: ZodError): string[] {
  const lines = error.issues.map((issue) => {
    const [section, index] = issue.path;
    const name = SECTION_NAMES[String(section)] ?? 'Profile';
    return typeof index === 'number'
      ? `${name} ${String(index + 1)}: ${issue.message}`
      : `${name}: ${issue.message}`;
  });
  return [...new Set(lines)].slice(0, 8);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

type Pending = 'discard' | 'import-file' | 'import-text' | null;

export function ProfileScreen() {
  const saved = useProfile();
  const versions = useProfileVersions();
  const { working, setWorking } = useWorkspace();
  const save = useSaveProfile();
  const importFile = useImportFile();
  const importText = useImportText();

  const [note, setNote] = useState('');
  const [problems, setProblems] = useState<string[]>([]);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [pending, setPending] = useState<Pending>(null);

  const base = saved.data?.profile ?? null;
  const profile = working?.profile ?? base;
  const dirty = isDirty(working);
  const importing = importFile.isPending || importText.isPending;
  const importError = importFile.error ?? importText.error;
  const flags = new Set(working?.lowConfidence ?? []);

  function update(change: (profile: DraftProfile) => DraftProfile) {
    setWorking((current) => {
      const start =
        current ??
        (base
          ? { profile: base, baseline: JSON.stringify(base), lowConfidence: [], warnings: [] }
          : null);
      return start ? { ...start, profile: change(start.profile) } : current;
    });
  }

  async function runImportFile() {
    setPending(null);
    importText.reset();
    try {
      const draft = await importFile.mutateAsync();
      if (draft) {
        setWorking(workingFromImport(draft));
        setProblems([]);
      }
    } catch {
      // The error is shown from the mutation state below.
    }
  }

  async function runImportText() {
    setPending(null);
    importFile.reset();
    try {
      setWorking(workingFromImport(await importText.mutateAsync(pasted)));
      setProblems([]);
      setPasting(false);
      setPasted('');
    } catch {
      // Shown from the mutation state.
    }
  }

  function ask(kind: 'import-file' | 'import-text') {
    if (dirty) setPending(kind);
    else void (kind === 'import-file' ? runImportFile() : runImportText());
  }

  function submit() {
    if (!working) return;
    const parsed = profileSchema.safeParse(working.profile);
    if (!parsed.success) {
      setProblems(describe(parsed.error));
      return;
    }
    setProblems([]);
    save.mutate(
      {
        profile: parsed.data,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(working.importId ? { importId: working.importId } : {}),
      },
      {
        onSuccess: () => {
          setWorking(null);
          setNote('');
        },
      },
    );
  }

  const nextVersion = (saved.data?.version ?? 0) + 1;
  const aside = saved.data
    ? `v${String(saved.data.version)} · saved ${formatDate(saved.data.createdAt)}`
    : 'no profile yet';

  return (
    <>
      <ScreenHeader
        title="Profile"
        aside={aside}
        actions={
          profile && (
            <div className="flex gap-3">
              <button
                type="button"
                className="btn-ghost"
                disabled={importing}
                onClick={() => ask('import-file')}
              >
                Import a resume
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={importing}
                onClick={() => setPasting((v) => !v)}
              >
                Paste text
              </button>
            </div>
          )
        }
      />

      <main className="flex-1 overflow-auto p-8">
        <div className="flex max-w-3xl flex-col gap-6 pb-28">
          {importing && (
            <p role="status" className="panel p-4 text-ink-2">
              Reading your resume. With a cloud model this takes up to a minute; a model on this PC
              can take longer.
            </p>
          )}
          {importError && (
            <p role="alert" className="field-error">
              {errorMessage(importError)}{' '}
              {/Settings/.test(errorMessage(importError)) && (
                <Link to="/settings" className="underline">
                  Open Settings
                </Link>
              )}
            </p>
          )}

          {(pasting || (!profile && !saved.isPending)) && (
            <div className="panel flex flex-col gap-3 p-5">
              {!profile && (
                <>
                  <h2 className="font-display-caps text-[1.75rem]">Start with your resume</h2>
                  <p className="max-w-xl text-ink-2">
                    jobowl reads it into a profile you check and correct. That profile is the only
                    source of facts for everything jobowl writes later. The AI picks and rewords
                    from it; it never adds to it.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="btn-ink"
                      disabled={importing}
                      onClick={() => ask('import-file')}
                    >
                      Import a resume
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={importing}
                      onClick={() => setPasting((v) => !v)}
                    >
                      Paste text
                    </button>
                    <button
                      type="button"
                      className="btn-quiet"
                      onClick={() =>
                        setWorking({
                          profile: emptyProfile(),
                          baseline: JSON.stringify(emptyProfile()),
                          lowConfidence: [],
                          warnings: [],
                        })
                      }
                    >
                      Start from blank
                    </button>
                  </div>
                  <p className="text-[0.8125rem] text-ink-3">
                    PDF, DOCX or plain text, up to 10 MB.
                  </p>
                </>
              )}
              {pasting && (
                <>
                  <label htmlFor="pasted-resume" className="meta-label">
                    Resume text
                  </label>
                  <textarea
                    id="pasted-resume"
                    className="input"
                    rows={10}
                    value={pasted}
                    onChange={(event) => setPasted(event.target.value)}
                  />
                  <div>
                    <button
                      type="button"
                      className="btn-ink"
                      disabled={importing || pasted.trim().length < 40}
                      onClick={() => ask('import-text')}
                    >
                      Read this text
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {working?.fileName && (
            <section aria-label="Import review" className="panel flex flex-col gap-2 p-5">
              <h2 className="font-display-caps text-[1.5rem]">
                Check what was read from {working.fileName}
              </h2>
              <p className="text-ink-2">
                Nothing is saved yet. Anything marked in red wasn't found word for word in your
                resume or was unclear: check it against the original, fix it, then save.
              </p>
              {working.warnings.length > 0 && (
                <ul className="list-disc pl-5 text-ink-2">
                  {working.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {profile && (
            <>
              {versions.data && versions.data.length > 0 && (
                <details className="text-ink-2">
                  <summary className="cursor-pointer font-semibold">
                    History ({versions.data.length})
                  </summary>
                  <ol className="mt-3 flex flex-col gap-1">
                    {versions.data.map((v) => (
                      <li key={v.version} className="font-mono text-[0.8125rem]">
                        v{v.version} · {formatDate(v.createdAt)}
                        {v.note ? ` · ${v.note}` : ''}
                        {v.sourceName ? ` · from ${v.sourceName}` : ''}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
              <PersonSection profile={profile} update={update} flags={flags} />
              <SummarySection profile={profile} update={update} flags={flags} />
              <ExperienceSection profile={profile} update={update} flags={flags} />
              <ProjectsSection profile={profile} update={update} flags={flags} />
              <EducationSection profile={profile} update={update} flags={flags} />
              <CertificationsSection profile={profile} update={update} flags={flags} />
              <SkillsSection profile={profile} update={update} flags={flags} />
              <AnswersSection profile={profile} update={update} flags={flags} />
              <SamplesSection profile={profile} update={update} flags={flags} />
            </>
          )}
        </div>
      </main>

      {dirty && (
        <div className="sticky bottom-0 border-t-[1.5px] border-line-strong bg-raised px-8 py-4">
          <div className="flex max-w-3xl flex-col gap-3">
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
            <div className="flex items-center gap-3">
              <input
                className="input max-w-sm"
                aria-label="What changed (optional)"
                placeholder="What changed? (optional)"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
              <button type="button" className="btn-ink" disabled={save.isPending} onClick={submit}>
                Save as v{nextVersion}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setPending('discard')}>
                Discard changes
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pending !== null}
        title={pending === 'discard' ? 'Discard these changes?' : 'Replace your unsaved changes?'}
        description={
          pending === 'discard'
            ? 'Everything you changed since the last saved version will be lost.'
            : 'Importing starts a new draft. Your unsaved changes will be lost.'
        }
        confirmLabel={pending === 'discard' ? 'Discard changes' : 'Replace them'}
        cancelLabel="Keep editing"
        onOpenChange={(open) => !open && setPending(null)}
        onConfirm={() => {
          if (pending === 'discard') {
            setWorking(null);
            setProblems([]);
            setPending(null);
          } else if (pending === 'import-file') void runImportFile();
          else if (pending === 'import-text') void runImportText();
        }}
      />
    </>
  );
}
