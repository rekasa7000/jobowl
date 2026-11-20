import { z } from 'zod';

const id = z.string().min(1).max(64);
/** `YYYY`, `YYYY-MM`, `present`, or empty when the resume didn't say. Never guessed. */
const dateField = z.string().regex(/^(\d{4}(-\d{2})?|present)?$/, 'Use YYYY or YYYY-MM');
const short = z.string().max(300);
const text = z.string().max(2000);

export const bulletSchema = z.object({
  id,
  text: text.min(1, 'A bullet needs some text'),
  /** Numbers and amounts found in `text`, extracted when the profile is saved. */
  metrics: z.array(z.string().max(60)).max(30),
  tags: z.array(short).max(20),
  hidden: z.boolean().optional(),
});
export type Bullet = z.infer<typeof bulletSchema>;

export const skillSchema = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  aliases: z.array(z.string().max(80)).max(10),
  level: z.enum(['familiar', 'proficient', 'expert']).optional(),
  years: z.number().min(0).max(60).optional(),
});
export type Skill = z.infer<typeof skillSchema>;

export const experienceSchema = z.object({
  id,
  employer: short.min(1, 'Employer is required'),
  title: short.min(1, 'Title is required'),
  location: short.optional(),
  employmentType: z
    .enum(['full-time', 'part-time', 'contract', 'internship', 'freelance'])
    .optional(),
  start: dateField,
  end: dateField,
  bullets: z.array(bulletSchema).max(40),
  skills: z.array(id).max(60),
});
export type Experience = z.infer<typeof experienceSchema>;

export const projectSchema = z.object({
  id,
  name: short.min(1, 'Project name is required'),
  role: short.optional(),
  url: z.string().max(500).optional(),
  start: dateField.optional(),
  end: dateField.optional(),
  bullets: z.array(bulletSchema).max(40),
  skills: z.array(id).max(60),
});
export type Project = z.infer<typeof projectSchema>;

export const educationSchema = z.object({
  id,
  school: short.min(1, 'School is required'),
  degree: short.optional(),
  field: short.optional(),
  start: dateField.optional(),
  end: dateField.optional(),
  honors: z.array(short).max(10).optional(),
});
export type Education = z.infer<typeof educationSchema>;

export const certificationSchema = z.object({
  id,
  name: short.min(1, 'Certification name is required'),
  issuer: short.optional(),
  date: dateField.optional(),
  url: z.string().max(500).optional(),
});
export type Certification = z.infer<typeof certificationSchema>;

/** Questions application forms ask again and again. Answered once, by the user, never by AI. */
export const standardAnswerKeySchema = z.enum([
  'work_authorization',
  'requires_sponsorship',
  'notice_period',
  'salary_expectation',
  'willing_to_relocate',
  'earliest_start_date',
  'pronouns',
  'gender',
  'race_ethnicity',
  'veteran_status',
  'disability_status',
  'how_did_you_hear',
  'custom',
]);
export type StandardAnswerKey = z.infer<typeof standardAnswerKeySchema>;

export const STANDARD_ANSWER_LABELS: Record<Exclude<StandardAnswerKey, 'custom'>, string> = {
  work_authorization: 'Work authorization',
  requires_sponsorship: 'Requires sponsorship',
  notice_period: 'Notice period',
  salary_expectation: 'Salary expectation',
  willing_to_relocate: 'Willing to relocate',
  earliest_start_date: 'Earliest start date',
  pronouns: 'Pronouns',
  gender: 'Gender',
  race_ethnicity: 'Race or ethnicity',
  veteran_status: 'Veteran status',
  disability_status: 'Disability status',
  how_did_you_hear: 'How did you hear about us',
};

export const standardAnswerSchema = z.object({
  id,
  key: standardAnswerKeySchema,
  question: short.optional(),
  answer: text,
});
export type StandardAnswer = z.infer<typeof standardAnswerSchema>;

export const profileSchema = z.object({
  schemaVersion: z.literal(1),
  person: z.object({
    fullName: short.min(1, 'Your name is required'),
    headline: short.optional(),
    email: short,
    phone: z.string().max(60).optional(),
    location: short.optional(),
    links: z.array(z.object({ label: z.string().max(80), url: z.string().max(500) })).max(20),
  }),
  summary: z.object({ id, text }).optional(),
  experiences: z.array(experienceSchema).max(40),
  projects: z.array(projectSchema).max(40),
  education: z.array(educationSchema).max(20),
  certifications: z.array(certificationSchema).max(40),
  skills: z.array(skillSchema).max(300),
  languages: z
    .array(z.object({ name: z.string().max(80), level: z.string().max(80).optional() }))
    .max(20),
  standardAnswers: z.array(standardAnswerSchema).max(60),
  writingSamples: z.array(z.object({ id, text: z.string().max(6000) })).max(5),
});
export type Profile = z.infer<typeof profileSchema>;

export function emptyProfile(): Profile {
  return {
    schemaVersion: 1,
    person: { fullName: '', email: '', links: [] },
    experiences: [],
    projects: [],
    education: [],
    certifications: [],
    skills: [],
    languages: [],
    standardAnswers: [],
    writingSamples: [],
  };
}

/** Item ids look like `exp_3f9a2c1b`: a short prefix for the kind, then random characters. */
export function newId(
  prefix: 'exp' | 'prj' | 'edu' | 'crt' | 'skl' | 'blt' | 'ans' | 'sum' | 'wrt',
): string {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 8)}`;
}

export const profileVersionSchema = z.object({
  version: z.number().int().positive(),
  note: z.string().nullable(),
  createdAt: z.string(),
  sourceName: z.string().nullable(),
});
export type ProfileVersionInfo = z.infer<typeof profileVersionSchema>;

export const savedProfileSchema = profileVersionSchema.extend({ profile: profileSchema });
export type SavedProfile = z.infer<typeof savedProfileSchema>;

export const saveProfileSchema = z.object({
  profile: profileSchema,
  note: z.string().trim().max(200).optional(),
  /** Set when saving a draft that came from an import, so the original file is linked. */
  importId: z.string().max(64).optional(),
});

/** A draft may have no name yet; everything else follows the profile rules. The user fixes it in review. */
export const draftProfileSchema = profileSchema.extend({
  person: profileSchema.shape.person.extend({ fullName: z.string().max(300) }),
});
export type DraftProfile = z.infer<typeof draftProfileSchema>;

export const importDraftSchema = z.object({
  /** Passed back when saving, so the version records which file it came from. */
  importId: z.string().min(1).max(64),
  fileName: z.string(),
  profile: draftProfileSchema,
  /** Ids (or `person.email`, `person.fullName`) the user should check first. */
  lowConfidence: z.array(z.string()),
  warnings: z.array(z.string()),
});
export type ImportDraft = z.infer<typeof importDraftSchema>;

export const importTextSchema = z.object({ text: z.string().min(40).max(100_000) });
