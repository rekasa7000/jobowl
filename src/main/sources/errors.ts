import type { z } from 'zod';
import type { sourceStatusSchema } from '@shared/schemas/discovery';

type Status = z.infer<typeof sourceStatusSchema>;

/** A source failed in a way worth showing. `status` is what the Sources screen displays. */
export class SourceError extends Error {
  constructor(
    message: string,
    readonly status: Status,
  ) {
    super(message);
  }
}

export const unavailable = (message: string) => new SourceError(message, 'error');
export const rateLimited = (message: string) => new SourceError(message, 'rate_limited');
/** The site said no (403, a challenge). jobowl doesn't work around it. */
export const blocked = (message: string) => new SourceError(message, 'blocked');
