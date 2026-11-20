import { z } from 'zod';
import { statusSchema } from '../statuses';

export const idSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, 'Not a valid id');

function isRealDate(value: string): boolean {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** A calendar date with no time, as `YYYY-MM-DD`. */
export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine(isRealDate, 'That date does not exist');

const nameSchema = z.string().trim().min(1, 'Required').max(200, 'Keep it under 200 characters');
const notesSchema = z.string().max(20_000, 'Notes are limited to 20,000 characters');

export const channelSchema = z.enum(['form', 'email', 'manual']);

export const applicationSchema = z.object({
  id: idSchema,
  company: z.string(),
  position: z.string(),
  status: statusSchema,
  channel: channelSchema,
  dateApplied: dateOnlySchema.nullable(),
  notes: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastActivityAt: z.string(),
});
export type Application = z.infer<typeof applicationSchema>;

export const eventKindSchema = z.enum(['created', 'status_changed', 'edited', 'note']);
export type EventKind = z.infer<typeof eventKindSchema>;

export const applicationEventSchema = z.object({
  id: idSchema,
  at: z.string(),
  kind: eventKindSchema,
  /** Short string facts about the event: `from`, `to`, `via`, `text`, or `fields` joined by commas. */
  details: z.record(z.string(), z.string()),
});
export type ApplicationEvent = z.infer<typeof applicationEventSchema>;

export const applicationDetailSchema = z.object({
  application: applicationSchema,
  events: z.array(applicationEventSchema),
});
export type ApplicationDetail = z.infer<typeof applicationDetailSchema>;

export const listFilterSchema = z.object({
  search: z.string().max(200).optional(),
  status: z.union([statusSchema, z.literal('all')]).optional(),
});
export type ListFilter = z.infer<typeof listFilterSchema>;

export const createApplicationSchema = z.object({
  company: nameSchema,
  position: nameSchema,
  status: statusSchema.optional(),
  dateApplied: dateOnlySchema.nullable().optional(),
  notes: notesSchema.optional(),
});
export type CreateApplication = z.infer<typeof createApplicationSchema>;

/** No defaults here: a patch changes only the fields it names. */
export const applicationPatchSchema = z
  .object({
    company: nameSchema,
    position: nameSchema,
    status: statusSchema,
    dateApplied: dateOnlySchema.nullable(),
    notes: notesSchema,
  })
  .partial()
  .strict();
export type ApplicationPatch = z.infer<typeof applicationPatchSchema>;

export const updateApplicationSchema = z.object({ id: idSchema, patch: applicationPatchSchema });

export const legacyDetectSchema = z.object({
  found: z.boolean(),
  path: z.string(),
  total: z.number().int().nonnegative(),
  samples: z.number().int().nonnegative(),
  alreadyImported: z.number().int().nonnegative(),
  error: z.string().optional(),
});
export type LegacyDetect = z.infer<typeof legacyDetectSchema>;

export const legacyImportResultSchema = z.object({
  imported: z.number().int().nonnegative(),
  skippedExisting: z.number().int().nonnegative(),
  skippedSamples: z.number().int().nonnegative(),
  unknownStatus: z.number().int().nonnegative(),
});
export type LegacyImportResult = z.infer<typeof legacyImportResultSchema>;
