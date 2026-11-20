import type { ParsedResume } from '../../../src/main/ai/layers/parser';

/** What a careful parser returns for tests/fixtures/resumes/ada-lovelace.*: copied, not written. */
export function adaParse(): ParsedResume {
  return {
    person: {
      fullName: 'Ada Lovelace',
      headline: 'Analytical Engineer',
      email: 'ada@example.com',
      phone: '+44 20 7946 0000',
      location: 'London, UK',
      links: [{ label: 'GitHub', url: 'github.com/ada-example' }],
    },
    summary: 'Engineer who writes programs for mechanical computers and explains them clearly.',
    experiences: [
      {
        employer: 'Analytical Engines Ltd',
        title: 'Senior Engineer',
        location: 'London',
        employmentType: 'unknown',
        start: 'Jan 2020',
        end: 'Present',
        bullets: [
          'Cut run time of the Bernoulli number program by 40% across 12 machines',
          'Wrote the first published algorithm for the Analytical Engine',
          'Mentored 4 junior engineers through their first production release',
        ],
        skills: ['Algorithms'],
        uncertain: false,
      },
      {
        employer: 'Difference Works',
        title: 'Engineer',
        location: 'London',
        employmentType: 'unknown',
        start: 'Mar 2017',
        end: 'Dec 2019',
        bullets: [
          'Built a tabulation tool used by 30 clerks daily',
          'Reduced punch-card errors from 8% to 1%',
        ],
        skills: [],
        uncertain: false,
      },
    ],
    projects: [
      {
        name: 'Notes on the Analytical Engine',
        role: '',
        url: '',
        start: '',
        end: '',
        bullets: [
          'Translated and annotated a paper on the engine, tripling its length with original notes.',
        ],
        skills: [],
        uncertain: false,
      },
    ],
    education: [
      {
        school: 'University of London',
        degree: 'BSc',
        field: 'Mathematics',
        start: '2013',
        end: '2017',
        uncertain: false,
      },
    ],
    certifications: [
      { name: 'Royal Society Fellow Candidate', issuer: '', date: '2019', uncertain: false },
    ],
    skills: ['Mathematics', 'algorithms', 'Punch card programming', 'Technical writing'],
    languages: [],
  };
}
