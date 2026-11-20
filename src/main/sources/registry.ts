import type { SourceConfig, SourceType } from '@shared/schemas/discovery';
import type { Connector } from './connector';
import { adzuna, arbeitnow, remoteok, remotive } from './connectors/aggregators';
import { ashby } from './connectors/ashby';
import { greenhouse } from './connectors/greenhouse';
import { lever } from './connectors/lever';
import { prettify } from './normalise';

// Each connector is typed to its own config; the registry only needs the shared shape.
export const connectors = {
  greenhouse,
  lever,
  ashby,
  remotive,
  remoteok,
  arbeitnow,
  adzuna,
} as unknown as Record<SourceType, Connector<SourceConfig>>;

export interface Detected {
  type: SourceType;
  config: SourceConfig;
  label: string;
}

/** Recognises a careers page or board address and says which connector reads it. */
export function detectSource(input: string): Detected | null {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  const first = url.pathname.split('/').filter(Boolean)[0];
  const board = (type: 'greenhouse' | 'lever' | 'ashby', key: string): Detected | null =>
    first ? { type, config: { [key]: first }, label: prettify(first) } : null;

  if (host === 'boards.greenhouse.io' || host === 'job-boards.greenhouse.io')
    return board('greenhouse', 'board');
  if (host === 'jobs.lever.co') return board('lever', 'company');
  if (host === 'jobs.ashbyhq.com') return board('ashby', 'board');
  if (host === 'remotive.com' || host === 'remotive.io')
    return { type: 'remotive', config: {}, label: 'Remotive' };
  if (host === 'remoteok.com') return { type: 'remoteok', config: {}, label: 'RemoteOK' };
  if (host === 'arbeitnow.com') return { type: 'arbeitnow', config: {}, label: 'Arbeitnow' };
  return null;
}
