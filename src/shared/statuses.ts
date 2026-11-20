import { z } from 'zod';

export const statusSchema = z.enum([
  'draft',
  'applied',
  'interview',
  'offer',
  'rejected',
  'withdrawn',
]);
export type Status = z.infer<typeof statusSchema>;

export const STATUS_LABELS: Record<Status, string> = {
  draft: 'Draft',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

/** Lower sorts first: what needs attention is on top. */
const PRIORITY: Record<Status, number> = {
  interview: 0,
  offer: 1,
  applied: 2,
  draft: 3,
  rejected: 4,
  withdrawn: 5,
};

export function statusPriority(status: Status): number {
  return PRIORITY[status];
}
