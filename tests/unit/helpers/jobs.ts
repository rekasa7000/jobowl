import type { SearchFields } from '@shared/schemas/discovery';
import { defaultSearch } from '@shared/schemas/discovery';
import type { NormalisedJob } from '../../../src/main/sources/connector';

export function job(overrides: Partial<NormalisedJob> = {}): NormalisedJob {
  const id = overrides.externalId ?? 'job-1';
  return {
    externalId: id,
    url: `https://example.test/jobs/${id}`,
    applyUrl: null,
    applyKind: 'external',
    company: 'Acme',
    title: 'Frontend Engineer',
    location: 'Manila',
    remoteMode: 'remote',
    employmentType: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    description: 'Build interfaces with React and TypeScript.',
    // Yesterday, so the age filter never depends on when the tests run.
    postedAt: new Date(Date.now() - 86_400_000).toISOString(),
    ...overrides,
  };
}

export function search(overrides: Partial<SearchFields> = {}): SearchFields {
  return { ...defaultSearch(), name: 'Frontend', titles: ['Frontend Engineer'], ...overrides };
}
