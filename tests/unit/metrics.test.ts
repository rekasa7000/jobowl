import { describe, expect, it } from 'vitest';
import { extractMetrics } from '@shared/metrics';

describe('extractMetrics', () => {
  it('finds percentages, money and counts', () => {
    expect(extractMetrics('Cut build time by 40% for 12 teams, saving $120,000 a year')).toEqual([
      '40%',
      '12',
      '$120,000',
    ]);
  });

  it('keeps magnitude suffixes and multipliers together', () => {
    expect(extractMetrics('Served 2.5M users, 10k requests/s, a 3x speedup')).toEqual([
      '2.5M',
      '10k',
      '3x',
    ]);
  });

  it('handles peso and euro amounts and plus signs', () => {
    expect(extractMetrics('Managed ₱1.2M budget and 50+ clients, €300k pipeline')).toEqual([
      '₱1.2M',
      '50+',
      '€300k',
    ]);
  });

  it('lists a repeated number once', () => {
    expect(extractMetrics('Ran 5 workshops, then 5 more')).toEqual(['5']);
  });

  it('returns nothing for a line with no numbers', () => {
    expect(extractMetrics('Built the onboarding flow')).toEqual([]);
  });
});
