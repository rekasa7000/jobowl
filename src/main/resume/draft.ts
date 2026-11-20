import type { ParsedResume } from '../ai/layers/parser';
import { newId, type Bullet, type DraftProfile, type Skill } from '@shared/schemas/profile';

export interface Draft {
  profile: DraftProfile;
  lowConfidence: string[];
  warnings: string[];
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** `YYYY-MM`, `YYYY`, `present`, or "" when it can't be read. `null` means the text was unreadable. */
export function normalizeDate(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (value === '') return '';
  if (/^(present|current|now|ongoing|today)$/.test(value)) return 'present';
  if (/^\d{4}$/.test(value)) return value;
  const iso = /^(\d{4})-(\d{1,2})$/.exec(value) ?? /^(\d{1,2})\/(\d{4})$/.exec(value);
  if (iso) {
    const [year, month] = iso[1]?.length === 4 ? [iso[1], iso[2]] : [iso[2], iso[1]];
    const m = Number(month);
    return m >= 1 && m <= 12 ? `${year ?? ''}-${String(m).padStart(2, '0')}` : null;
  }
  const named = /^([a-z]{3,9})\.?,?\s+(\d{4})$/.exec(value);
  if (named) {
    const index = MONTHS.indexOf((named[1] ?? '').slice(0, 3));
    return index >= 0 ? `${named[2] ?? ''}-${String(index + 1).padStart(2, '0')}` : null;
  }
  return null;
}

/** Letters and digits only, lower-cased, so line breaks and punctuation can't hide a match. */
function squash(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function cleanBullet(text: string): string {
  return text
    .replace(/^[\s•\-*–—·▪●○]+/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Turns the parser's answer into a profile with ids, and says what to double-check. Anything
 * that can't be found in the resume text is flagged: the parser must copy, not write.
 */
export function buildDraft(parsed: ParsedResume, sourceText: string): Draft {
  const source = squash(sourceText);
  const lowConfidence: string[] = [];
  const warnings: string[] = [];
  const skills: Skill[] = [];
  let ungrounded = 0;
  let badDates = 0;

  const grounded = (value: string, id: string): void => {
    if (value.trim() !== '' && !source.includes(squash(value))) {
      lowConfidence.push(id);
      ungrounded += 1;
    }
  };

  const date = (raw: string, id: string): string => {
    const result = normalizeDate(raw);
    if (result === null) {
      badDates += 1;
      lowConfidence.push(id);
      return '';
    }
    return result;
  };

  const skillIds = (names: string[]): string[] =>
    names.flatMap((name) => {
      const clean = name.trim();
      if (clean === '') return [];
      const existing = skills.find((s) => s.name.toLowerCase() === clean.toLowerCase());
      if (existing) return [existing.id];
      const skill: Skill = { id: newId('skl'), name: clean.slice(0, 80), aliases: [] };
      skills.push(skill);
      return [skill.id];
    });

  const bullets = (lines: string[], ownerId: string): Bullet[] =>
    lines
      .map(cleanBullet)
      .filter((text) => text !== '')
      .map((text) => {
        const id = newId('blt');
        grounded(text, id);
        return { id, text: text.slice(0, 2000), metrics: [], tags: [] };
      })
      .map((bullet) => {
        // A flagged bullet marks its owner too, so collapsed sections still show the warning.
        if (lowConfidence.includes(bullet.id) && !lowConfidence.includes(ownerId)) {
          lowConfidence.push(ownerId);
        }
        return bullet;
      });

  const experiences = parsed.experiences.flatMap((item) => {
    if (item.employer.trim() === '' || item.title.trim() === '') {
      warnings.push('Skipped a work entry that had no employer or no title.');
      return [];
    }
    const id = newId('exp');
    grounded(item.employer, id);
    grounded(item.title, id);
    if (item.uncertain) lowConfidence.push(id);
    const start = date(item.start, id);
    const end = date(item.end, id);
    return [
      {
        id,
        employer: item.employer.trim().slice(0, 300),
        title: item.title.trim().slice(0, 300),
        ...(item.location.trim() ? { location: item.location.trim().slice(0, 300) } : {}),
        ...(item.employmentType !== 'unknown' ? { employmentType: item.employmentType } : {}),
        start,
        end,
        bullets: bullets(item.bullets, id),
        skills: skillIds(item.skills),
      },
    ];
  });

  const projects = parsed.projects.flatMap((item) => {
    if (item.name.trim() === '') {
      warnings.push('Skipped a project that had no name.');
      return [];
    }
    const id = newId('prj');
    grounded(item.name, id);
    if (item.uncertain) lowConfidence.push(id);
    const start = date(item.start, id);
    const end = date(item.end, id);
    return [
      {
        id,
        name: item.name.trim().slice(0, 300),
        ...(item.role.trim() ? { role: item.role.trim().slice(0, 300) } : {}),
        ...(item.url.trim() ? { url: item.url.trim().slice(0, 500) } : {}),
        ...(start ? { start } : {}),
        ...(end ? { end } : {}),
        bullets: bullets(item.bullets, id),
        skills: skillIds(item.skills),
      },
    ];
  });

  const education = parsed.education.flatMap((item) => {
    if (item.school.trim() === '') {
      warnings.push('Skipped an education entry that had no school.');
      return [];
    }
    const id = newId('edu');
    grounded(item.school, id);
    if (item.uncertain) lowConfidence.push(id);
    const start = date(item.start, id);
    const end = date(item.end, id);
    return [
      {
        id,
        school: item.school.trim().slice(0, 300),
        ...(item.degree.trim() ? { degree: item.degree.trim().slice(0, 300) } : {}),
        ...(item.field.trim() ? { field: item.field.trim().slice(0, 300) } : {}),
        ...(start ? { start } : {}),
        ...(end ? { end } : {}),
      },
    ];
  });

  const certifications = parsed.certifications.flatMap((item) => {
    if (item.name.trim() === '') return [];
    const id = newId('crt');
    grounded(item.name, id);
    if (item.uncertain) lowConfidence.push(id);
    const issued = date(item.date, id);
    return [
      {
        id,
        name: item.name.trim().slice(0, 300),
        ...(item.issuer.trim() ? { issuer: item.issuer.trim().slice(0, 300) } : {}),
        ...(issued ? { date: issued } : {}),
      },
    ];
  });

  skillIds(parsed.skills);

  const email = parsed.person.email.trim();
  if (!email.includes('@')) lowConfidence.push('person.email');
  if (parsed.person.fullName.trim() === '') lowConfidence.push('person.fullName');
  else grounded(parsed.person.fullName, 'person.fullName');

  if (ungrounded > 0) {
    warnings.push(
      `${ungrounded} ${ungrounded === 1 ? 'item doesn' : 'items don'}'t match the resume text word for word. They're highlighted: check them against your resume.`,
    );
  }
  if (badDates > 0) {
    warnings.push(
      `${badDates} ${badDates === 1 ? 'date was' : 'dates were'} unclear and left empty.`,
    );
  }

  const person = parsed.person;
  const profile: DraftProfile = {
    schemaVersion: 1,
    person: {
      fullName: person.fullName.trim().slice(0, 300),
      ...(person.headline.trim() ? { headline: person.headline.trim().slice(0, 300) } : {}),
      email: email.slice(0, 300),
      ...(person.phone.trim() ? { phone: person.phone.trim().slice(0, 60) } : {}),
      ...(person.location.trim() ? { location: person.location.trim().slice(0, 300) } : {}),
      links: person.links
        .filter((link) => link.url.trim() !== '')
        .map((link) => ({
          label: link.label.trim().slice(0, 80),
          url: link.url.trim().slice(0, 500),
        })),
    },
    ...(parsed.summary.trim()
      ? { summary: { id: newId('sum'), text: parsed.summary.trim().slice(0, 2000) } }
      : {}),
    experiences,
    projects,
    education,
    certifications,
    skills,
    languages: parsed.languages
      .filter((language) => language.name.trim() !== '')
      .map((language) => ({
        name: language.name.trim().slice(0, 80),
        ...(language.level.trim() ? { level: language.level.trim().slice(0, 80) } : {}),
      })),
    standardAnswers: [],
    writingSamples: [],
  };

  return { profile, lowConfidence: [...new Set(lowConfidence)], warnings };
}
