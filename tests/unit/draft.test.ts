import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { draftProfileSchema, profileSchema } from '@shared/schemas/profile';
import { buildDraft, normalizeDate } from '../../src/main/resume/draft';
import { adaParse } from './helpers/ada';

const source = readFileSync(
  join(import.meta.dirname, '../fixtures/resumes/ada-lovelace.txt'),
  'utf8',
);

describe('normalizeDate', () => {
  it.each([
    ['Jan 2020', '2020-01'],
    ['January 2020', '2020-01'],
    ['sept. 2021', '2021-09'],
    ['03/2018', '2018-03'],
    ['2018-3', '2018-03'],
    ['2019', '2019'],
    ['Present', 'present'],
    ['current', 'present'],
    ['', ''],
  ])('reads %j as %j', (raw, expected) => {
    expect(normalizeDate(raw)).toBe(expected);
  });

  it.each(['last spring', '13/2020', 'Smarch 2020', '2020-13'])('refuses to guess %j', (raw) => {
    expect(normalizeDate(raw)).toBeNull();
  });
});

describe('buildDraft', () => {
  it('builds a valid profile from a faithful parse, with nothing flagged', () => {
    const { profile, lowConfidence, warnings } = buildDraft(adaParse(), source);
    expect(draftProfileSchema.safeParse(profile).success).toBe(true);
    expect(profileSchema.safeParse(profile).success).toBe(true);
    expect(lowConfidence).toEqual([]);
    expect(warnings).toEqual([]);
    expect(profile.experiences[0]).toMatchObject({ start: '2020-01', end: 'present' });
    expect(profile.experiences[1]).toMatchObject({ start: '2017-03', end: '2019-12' });
  });

  it('keeps bullet text exactly and gives every item its own id', () => {
    const { profile } = buildDraft(adaParse(), source);
    const bullets = profile.experiences.flatMap((e) => e.bullets);
    expect(bullets[0]?.text).toBe(
      'Cut run time of the Bernoulli number program by 40% across 12 machines',
    );
    const ids = [
      ...profile.experiences.map((e) => e.id),
      ...bullets.map((b) => b.id),
      ...profile.skills.map((s) => s.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('merges skills named twice, case-insensitively, and links them to the role', () => {
    const { profile } = buildDraft(adaParse(), source);
    const names = profile.skills.map((s) => s.name);
    expect(names.filter((n) => n.toLowerCase() === 'algorithms')).toHaveLength(1);
    const algorithms = profile.skills.find((s) => s.name.toLowerCase() === 'algorithms');
    expect(profile.experiences[0]?.skills).toEqual([algorithms?.id]);
  });

  it('flags a bullet the model invented, and the role it sits in', () => {
    const parsed = adaParse();
    parsed.experiences[0]?.bullets.push('Led a team of 50 engineers and saved $2M annually');
    const { profile, lowConfidence, warnings } = buildDraft(parsed, source);

    const invented = profile.experiences[0]?.bullets.at(-1);
    expect(lowConfidence).toContain(invented?.id);
    expect(lowConfidence).toContain(profile.experiences[0]?.id);
    expect(lowConfidence).not.toContain(profile.experiences[0]?.bullets[0]?.id);
    expect(warnings.join(' ')).toMatch(/1 item doesn't match the resume text word for word/);
  });

  it('flags an employer that is not in the resume', () => {
    const parsed = adaParse();
    if (parsed.experiences[1]) parsed.experiences[1].employer = 'Babbage & Sons';
    const { profile, lowConfidence } = buildDraft(parsed, source);
    expect(lowConfidence).toContain(profile.experiences[1]?.id);
  });

  it('is not fooled by line breaks, bullets or punctuation in the source', () => {
    const parsed = adaParse();
    const wrapped = source.replace(
      'Built a tabulation tool used by',
      'Built a tabulation\n  tool - used by',
    );
    expect(buildDraft(parsed, wrapped).lowConfidence).toEqual([]);
  });

  it('leaves unreadable dates empty and says so', () => {
    const parsed = adaParse();
    if (parsed.experiences[0]) parsed.experiences[0].start = 'last spring';
    const { profile, lowConfidence, warnings } = buildDraft(parsed, source);
    expect(profile.experiences[0]?.start).toBe('');
    expect(lowConfidence).toContain(profile.experiences[0]?.id);
    expect(warnings).toContain('1 date was unclear and left empty.');
  });

  it('skips entries missing the field a profile requires, and says so', () => {
    const parsed = adaParse();
    if (parsed.experiences[0]) parsed.experiences[0].employer = ' ';
    const { profile, warnings } = buildDraft(parsed, source);
    expect(profile.experiences).toHaveLength(1);
    expect(warnings).toContain('Skipped a work entry that had no employer or no title.');
  });

  it('flags a missing email and a missing name for the user to fill in', () => {
    const parsed = adaParse();
    parsed.person.email = '';
    parsed.person.fullName = '';
    const { lowConfidence, profile } = buildDraft(parsed, source);
    expect(lowConfidence).toEqual(expect.arrayContaining(['person.email', 'person.fullName']));
    expect(draftProfileSchema.safeParse(profile).success).toBe(true);
    expect(profileSchema.safeParse(profile).success).toBe(false);
  });

  it('strips bullet glyphs and collapses spacing in bullets', () => {
    const parsed = adaParse();
    if (parsed.experiences[1])
      parsed.experiences[1].bullets = ['•   Built a tabulation tool used by 30 clerks   daily'];
    const { profile } = buildDraft(parsed, source);
    expect(profile.experiences[1]?.bullets[0]?.text).toBe(
      'Built a tabulation tool used by 30 clerks daily',
    );
  });
});
