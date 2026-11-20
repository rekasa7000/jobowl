import { useState } from 'react';
import {
  newId,
  STANDARD_ANSWER_LABELS,
  standardAnswerKeySchema,
  type Bullet,
  type DraftProfile,
  type Skill,
  type StandardAnswerKey,
} from '@shared/schemas/profile';
import {
  Checked,
  replaceAt,
  removeAt,
  Section,
  SelectField,
  setOptional,
  TextField,
} from './fields';

export interface SectionProps {
  profile: DraftProfile;
  update: (change: (profile: DraftProfile) => DraftProfile) => void;
  /** Ids the import flagged for a second look. */
  flags: ReadonlySet<string>;
}

const EMPLOYMENT_TYPES = [
  { value: '', label: 'Not stated' },
  { value: 'full-time', label: 'Full-time' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
  { value: 'freelance', label: 'Freelance' },
] as const;

/** Finds a skill by name (ignoring case) or adds it. Returns the profile and the skill's id. */
function ensureSkill(profile: DraftProfile, name: string): [DraftProfile, string] {
  const clean = name.trim();
  const existing = profile.skills.find((s) => s.name.toLowerCase() === clean.toLowerCase());
  if (existing) return [profile, existing.id];
  const skill: Skill = { id: newId('skl'), name: clean.slice(0, 80), aliases: [] };
  return [{ ...profile, skills: [...profile.skills, skill] }, skill.id];
}

const AddButton = ({ onClick, children }: { onClick: () => void; children: string }) => (
  <div>
    <button type="button" className="btn-ghost" onClick={onClick}>
      {children}
    </button>
  </div>
);

const RemoveButton = ({ onClick, what }: { onClick: () => void; what: string }) => (
  <button type="button" className="btn-quiet" aria-label={`Remove ${what}`} onClick={onClick}>
    Remove
  </button>
);

function BulletsEditor({
  bullets,
  flags,
  onChange,
}: {
  bullets: Bullet[];
  flags: ReadonlySet<string>;
  onChange: (next: Bullet[]) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="meta-label">Bullets</span>
      {bullets.map((bullet, index) => (
        <Checked key={bullet.id} flagged={flags.has(bullet.id)}>
          <div className="flex items-start gap-2">
            <textarea
              aria-label={`Bullet ${String(index + 1)}`}
              className="input"
              rows={2}
              value={bullet.text}
              onChange={(event) =>
                onChange(replaceAt(bullets, index, { ...bullet, text: event.target.value }))
              }
            />
            <RemoveButton
              what={`bullet ${String(index + 1)}`}
              onClick={() => onChange(removeAt(bullets, index))}
            />
          </div>
        </Checked>
      ))}
      <AddButton
        onClick={() =>
          onChange([...bullets, { id: newId('blt'), text: '', metrics: [], tags: [] }])
        }
      >
        Add bullet
      </AddButton>
    </div>
  );
}

function SkillChips({
  ids,
  profile,
  onAdd,
  onRemove,
}: {
  ids: string[];
  profile: DraftProfile;
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const listId = `skills-${ids.join('').slice(0, 12)}`;
  const add = () => {
    if (name.trim() === '') return;
    onAdd(name);
    setName('');
  };
  return (
    <div className="flex flex-col gap-2">
      <span className="meta-label">Skills used</span>
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => {
          const skill = profile.skills.find((s) => s.id === id);
          return skill ? (
            <span key={id} className="chip flex items-center gap-2">
              {skill.name}
              <button
                type="button"
                aria-label={`Remove ${skill.name}`}
                onClick={() => onRemove(id)}
              >
                ×
              </button>
            </span>
          ) : null;
        })}
      </div>
      <div className="flex gap-2">
        <input
          className="input"
          aria-label="Add a skill"
          placeholder="Add a skill"
          list={listId}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
        />
        <datalist id={listId}>
          {profile.skills.map((skill) => (
            <option key={skill.id} value={skill.name} />
          ))}
        </datalist>
        <button type="button" className="btn-ghost" onClick={add}>
          Add
        </button>
      </div>
    </div>
  );
}

export function PersonSection({ profile, update, flags }: SectionProps) {
  const { person } = profile;
  const set = (next: Partial<DraftProfile['person']>) =>
    update((p) => ({ ...p, person: { ...p.person, ...next } }));
  const optional = (key: 'headline' | 'phone' | 'location') => (value: string) =>
    update((p) => ({ ...p, person: setOptional(p.person, key, value) }));
  return (
    <Section title="You">
      <div className="grid grid-cols-2 gap-4">
        <Checked flagged={flags.has('person.fullName')}>
          <TextField
            label="Full name"
            value={person.fullName}
            onChange={(fullName) => set({ fullName })}
          />
        </Checked>
        <TextField label="Headline" value={person.headline ?? ''} onChange={optional('headline')} />
        <Checked flagged={flags.has('person.email')}>
          <TextField label="Email" value={person.email} onChange={(email) => set({ email })} />
        </Checked>
        <TextField label="Phone" value={person.phone ?? ''} onChange={optional('phone')} />
        <TextField label="Location" value={person.location ?? ''} onChange={optional('location')} />
      </div>
      <div className="flex flex-col gap-3">
        <span className="meta-label">Links</span>
        {person.links.map((link, index) => (
          <div key={index} className="flex items-end gap-2">
            <TextField
              label="Label"
              value={link.label}
              onChange={(label) =>
                set({ links: replaceAt(person.links, index, { ...link, label }) })
              }
            />
            <TextField
              label="Address"
              value={link.url}
              onChange={(url) => set({ links: replaceAt(person.links, index, { ...link, url }) })}
            />
            <RemoveButton
              what="link"
              onClick={() => set({ links: removeAt(person.links, index) })}
            />
          </div>
        ))}
        <AddButton onClick={() => set({ links: [...person.links, { label: '', url: '' }] })}>
          Add link
        </AddButton>
      </div>
    </Section>
  );
}

export function SummarySection({ profile, update, flags }: SectionProps) {
  return (
    <Section title="Summary">
      <Checked flagged={flags.has('summary')}>
        <TextField
          label="Your own summary"
          multiline
          rows={4}
          value={profile.summary?.text ?? ''}
          help="Optional. jobowl may shorten it for a job but never adds to it."
          onChange={(text) =>
            update(({ summary: _old, ...rest }) =>
              text === '' ? rest : { ...rest, summary: { id: _old?.id ?? newId('sum'), text } },
            )
          }
        />
      </Checked>
    </Section>
  );
}

type RoleKind = 'experiences' | 'projects';

function useRoleSkills(update: SectionProps['update'], kind: RoleKind) {
  return {
    add: (index: number, name: string) =>
      update((p) => {
        const [withSkill, id] = ensureSkill(p, name);
        const items = withSkill[kind];
        const item = items[index];
        if (!item || item.skills.includes(id)) return withSkill;
        return {
          ...withSkill,
          [kind]: replaceAt(items, index, { ...item, skills: [...item.skills, id] }),
        };
      }),
    remove: (index: number, id: string) =>
      update((p) => {
        const item = p[kind][index];
        if (!item) return p;
        return {
          ...p,
          [kind]: replaceAt(p[kind], index, {
            ...item,
            skills: item.skills.filter((s) => s !== id),
          }),
        };
      }),
  };
}

export function ExperienceSection({ profile, update, flags }: SectionProps) {
  const skills = useRoleSkills(update, 'experiences');
  return (
    <Section
      title="Experience"
      count={profile.experiences.length}
      actions={
        <AddButton
          onClick={() =>
            update((p) => ({
              ...p,
              experiences: [
                ...p.experiences,
                {
                  id: newId('exp'),
                  employer: '',
                  title: '',
                  start: '',
                  end: '',
                  bullets: [],
                  skills: [],
                },
              ],
            }))
          }
        >
          Add experience
        </AddButton>
      }
    >
      {profile.experiences.map((job, index) => {
        const set = (next: typeof job) =>
          update((p) => ({ ...p, experiences: replaceAt(p.experiences, index, next) }));
        return (
          <Checked key={job.id} flagged={flags.has(job.id)}>
            <fieldset className="flex flex-col gap-4 rounded border border-line p-4">
              <legend className="meta-label px-2">
                {job.employer || 'New job'} · {job.title || 'untitled'}
              </legend>
              <div className="grid grid-cols-2 gap-4">
                <TextField
                  label="Employer"
                  value={job.employer}
                  onChange={(employer) => set({ ...job, employer })}
                />
                <TextField
                  label="Title"
                  value={job.title}
                  onChange={(title) => set({ ...job, title })}
                />
                <TextField
                  label="Location"
                  value={job.location ?? ''}
                  onChange={(v) => set(setOptional(job, 'location', v))}
                />
                <SelectField
                  label="Type"
                  value={job.employmentType ?? ''}
                  options={EMPLOYMENT_TYPES}
                  onChange={(value) => set(setOptional(job, 'employmentType', value))}
                />
                <TextField
                  label="Start"
                  placeholder="YYYY-MM"
                  value={job.start}
                  onChange={(start) => set({ ...job, start })}
                />
                <TextField
                  label="End"
                  placeholder="YYYY-MM or present"
                  value={job.end}
                  onChange={(end) => set({ ...job, end })}
                />
              </div>
              <BulletsEditor
                bullets={job.bullets}
                flags={flags}
                onChange={(bullets) => set({ ...job, bullets })}
              />
              <SkillChips
                ids={job.skills}
                profile={profile}
                onAdd={(name) => skills.add(index, name)}
                onRemove={(id) => skills.remove(index, id)}
              />
              <div>
                <RemoveButton
                  what={`${job.employer || 'this'} experience`}
                  onClick={() =>
                    update((p) => ({ ...p, experiences: removeAt(p.experiences, index) }))
                  }
                />
              </div>
            </fieldset>
          </Checked>
        );
      })}
    </Section>
  );
}

export function ProjectsSection({ profile, update, flags }: SectionProps) {
  const skills = useRoleSkills(update, 'projects');
  return (
    <Section
      title="Projects"
      count={profile.projects.length}
      actions={
        <AddButton
          onClick={() =>
            update((p) => ({
              ...p,
              projects: [...p.projects, { id: newId('prj'), name: '', bullets: [], skills: [] }],
            }))
          }
        >
          Add project
        </AddButton>
      }
    >
      {profile.projects.map((project, index) => {
        const set = (next: typeof project) =>
          update((p) => ({ ...p, projects: replaceAt(p.projects, index, next) }));
        return (
          <Checked key={project.id} flagged={flags.has(project.id)}>
            <fieldset className="flex flex-col gap-4 rounded border border-line p-4">
              <legend className="meta-label px-2">{project.name || 'New project'}</legend>
              <div className="grid grid-cols-2 gap-4">
                <TextField
                  label="Name"
                  value={project.name}
                  onChange={(name) => set({ ...project, name })}
                />
                <TextField
                  label="Role"
                  value={project.role ?? ''}
                  onChange={(v) => set(setOptional(project, 'role', v))}
                />
                <TextField
                  label="Address"
                  value={project.url ?? ''}
                  onChange={(v) => set(setOptional(project, 'url', v))}
                />
                <div className="grid grid-cols-2 gap-4">
                  <TextField
                    label="Start"
                    placeholder="YYYY-MM"
                    value={project.start ?? ''}
                    onChange={(v) => set(setOptional(project, 'start', v))}
                  />
                  <TextField
                    label="End"
                    placeholder="YYYY-MM"
                    value={project.end ?? ''}
                    onChange={(v) => set(setOptional(project, 'end', v))}
                  />
                </div>
              </div>
              <BulletsEditor
                bullets={project.bullets}
                flags={flags}
                onChange={(bullets) => set({ ...project, bullets })}
              />
              <SkillChips
                ids={project.skills}
                profile={profile}
                onAdd={(name) => skills.add(index, name)}
                onRemove={(id) => skills.remove(index, id)}
              />
              <div>
                <RemoveButton
                  what={`${project.name || 'this'} project`}
                  onClick={() => update((p) => ({ ...p, projects: removeAt(p.projects, index) }))}
                />
              </div>
            </fieldset>
          </Checked>
        );
      })}
    </Section>
  );
}

export function EducationSection({ profile, update, flags }: SectionProps) {
  return (
    <Section
      title="Education"
      count={profile.education.length}
      actions={
        <AddButton
          onClick={() =>
            update((p) => ({ ...p, education: [...p.education, { id: newId('edu'), school: '' }] }))
          }
        >
          Add education
        </AddButton>
      }
    >
      {profile.education.map((item, index) => {
        const set = (next: typeof item) =>
          update((p) => ({ ...p, education: replaceAt(p.education, index, next) }));
        return (
          <Checked key={item.id} flagged={flags.has(item.id)}>
            <div className="grid grid-cols-2 gap-4 rounded border border-line p-4">
              <TextField
                label="School"
                value={item.school}
                onChange={(school) => set({ ...item, school })}
              />
              <TextField
                label="Degree"
                value={item.degree ?? ''}
                onChange={(v) => set(setOptional(item, 'degree', v))}
              />
              <TextField
                label="Field"
                value={item.field ?? ''}
                onChange={(v) => set(setOptional(item, 'field', v))}
              />
              <div className="grid grid-cols-2 gap-4">
                <TextField
                  label="Start"
                  placeholder="YYYY"
                  value={item.start ?? ''}
                  onChange={(v) => set(setOptional(item, 'start', v))}
                />
                <TextField
                  label="End"
                  placeholder="YYYY"
                  value={item.end ?? ''}
                  onChange={(v) => set(setOptional(item, 'end', v))}
                />
              </div>
              <div>
                <RemoveButton
                  what={`${item.school || 'this'} education`}
                  onClick={() => update((p) => ({ ...p, education: removeAt(p.education, index) }))}
                />
              </div>
            </div>
          </Checked>
        );
      })}
    </Section>
  );
}

export function CertificationsSection({ profile, update, flags }: SectionProps) {
  return (
    <Section
      title="Certifications"
      count={profile.certifications.length}
      actions={
        <AddButton
          onClick={() =>
            update((p) => ({
              ...p,
              certifications: [...p.certifications, { id: newId('crt'), name: '' }],
            }))
          }
        >
          Add certification
        </AddButton>
      }
    >
      {profile.certifications.map((item, index) => {
        const set = (next: typeof item) =>
          update((p) => ({ ...p, certifications: replaceAt(p.certifications, index, next) }));
        return (
          <Checked key={item.id} flagged={flags.has(item.id)}>
            <div className="grid grid-cols-3 gap-4 rounded border border-line p-4">
              <TextField
                label="Name"
                value={item.name}
                onChange={(name) => set({ ...item, name })}
              />
              <TextField
                label="Issuer"
                value={item.issuer ?? ''}
                onChange={(v) => set(setOptional(item, 'issuer', v))}
              />
              <TextField
                label="Date"
                placeholder="YYYY-MM"
                value={item.date ?? ''}
                onChange={(v) => set(setOptional(item, 'date', v))}
              />
              <div>
                <RemoveButton
                  what={`${item.name || 'this'} certification`}
                  onClick={() =>
                    update((p) => ({ ...p, certifications: removeAt(p.certifications, index) }))
                  }
                />
              </div>
            </div>
          </Checked>
        );
      })}
    </Section>
  );
}

export function SkillsSection({ profile, update }: SectionProps) {
  const [name, setName] = useState('');
  const add = () => {
    if (name.trim() === '') return;
    update((p) => ensureSkill(p, name)[0]);
    setName('');
  };
  return (
    <Section title="Skills" count={profile.skills.length}>
      <div className="flex flex-wrap gap-2">
        {profile.skills.map((skill) => (
          <span key={skill.id} className="chip flex items-center gap-2">
            {skill.name}
            <button
              type="button"
              aria-label={`Remove ${skill.name}`}
              onClick={() =>
                update((p) => ({
                  ...p,
                  skills: p.skills.filter((s) => s.id !== skill.id),
                  experiences: p.experiences.map((e) => ({
                    ...e,
                    skills: e.skills.filter((s) => s !== skill.id),
                  })),
                  projects: p.projects.map((e) => ({
                    ...e,
                    skills: e.skills.filter((s) => s !== skill.id),
                  })),
                }))
              }
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex max-w-md gap-2">
        <input
          className="input"
          aria-label="Add a skill to your profile"
          placeholder="Add a skill"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="btn-ghost" onClick={add}>
          Add
        </button>
      </div>
    </Section>
  );
}

export function AnswersSection({ profile, update }: SectionProps) {
  const used = new Set(profile.standardAnswers.map((a) => a.key));
  const available = standardAnswerKeySchema.options.filter(
    (key) => key === 'custom' || !used.has(key),
  );
  const [next, setNext] = useState<StandardAnswerKey>(available[0] ?? 'custom');
  return (
    <Section title="Standard answers" count={profile.standardAnswers.length}>
      <p className="max-w-xl text-ink-2">
        Answers to questions forms ask again and again. jobowl only ever uses what you write here;
        it never makes these up.
      </p>
      {profile.standardAnswers.map((item, index) => {
        const set = (value: typeof item) =>
          update((p) => ({ ...p, standardAnswers: replaceAt(p.standardAnswers, index, value) }));
        const label =
          item.key === 'custom'
            ? (item.question ?? 'Custom question')
            : STANDARD_ANSWER_LABELS[item.key];
        return (
          <div key={item.id} className="flex items-start gap-3">
            <div className="grid flex-1 gap-3">
              {item.key === 'custom' && (
                <TextField
                  label="Question"
                  value={item.question ?? ''}
                  onChange={(v) => set(setOptional(item, 'question', v))}
                />
              )}
              <TextField
                label={label}
                multiline
                rows={2}
                value={item.answer}
                onChange={(answer) => set({ ...item, answer })}
              />
            </div>
            <RemoveButton
              what={label}
              onClick={() =>
                update((p) => ({ ...p, standardAnswers: removeAt(p.standardAnswers, index) }))
              }
            />
          </div>
        );
      })}
      <div className="flex max-w-md items-end gap-2">
        <SelectField
          label="Add an answer"
          value={available.includes(next) ? next : (available[0] ?? 'custom')}
          options={available.map((key) => ({
            value: key,
            label: key === 'custom' ? 'Your own question' : STANDARD_ANSWER_LABELS[key],
          }))}
          onChange={(value) => value && setNext(value)}
        />
        <button
          type="button"
          className="btn-ghost"
          onClick={() =>
            update((p) => ({
              ...p,
              standardAnswers: [...p.standardAnswers, { id: newId('ans'), key: next, answer: '' }],
            }))
          }
        >
          Add
        </button>
      </div>
    </Section>
  );
}

export function SamplesSection({ profile, update }: SectionProps) {
  return (
    <Section
      title="Writing samples"
      count={profile.writingSamples.length}
      actions={
        profile.writingSamples.length < 5 ? (
          <AddButton
            onClick={() =>
              update((p) => ({
                ...p,
                writingSamples: [...p.writingSamples, { id: newId('wrt'), text: '' }],
              }))
            }
          >
            Add a sample
          </AddButton>
        ) : undefined
      }
    >
      <p className="max-w-xl text-ink-2">
        A few paragraphs you wrote yourself, so emails and answers sound like you. They set the tone
        and are never quoted as facts.
      </p>
      {profile.writingSamples.map((sample, index) => (
        <div key={sample.id} className="flex items-start gap-2">
          <textarea
            aria-label={`Writing sample ${String(index + 1)}`}
            className="input"
            rows={5}
            value={sample.text}
            onChange={(event) =>
              update((p) => ({
                ...p,
                writingSamples: replaceAt(p.writingSamples, index, {
                  ...sample,
                  text: event.target.value,
                }),
              }))
            }
          />
          <RemoveButton
            what={`sample ${String(index + 1)}`}
            onClick={() =>
              update((p) => ({ ...p, writingSamples: removeAt(p.writingSamples, index) }))
            }
          />
        </div>
      ))}
    </Section>
  );
}
