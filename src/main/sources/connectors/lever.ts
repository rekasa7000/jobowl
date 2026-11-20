import { z } from 'zod';
import type { JobRemote } from '@shared/schemas/discovery';
import { collect, type Connector } from '../connector';
import { unavailable } from '../errors';
import { htmlToText, inferRemote, isoFromMs, toYearly } from '../normalise';

const configSchema = z.object({ company: z.string().min(1).max(100) });
const job = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  hostedUrl: z.string().min(1),
  applyUrl: z.string().nullish(),
  categories: z
    .object({
      location: z.string().nullish(),
      commitment: z.string().nullish(),
      allLocations: z.array(z.string()).nullish(),
    })
    .nullish(),
  workplaceType: z.string().nullish(),
  descriptionPlain: z.string().nullish(),
  description: z.string().nullish(),
  additionalPlain: z.string().nullish(),
  lists: z.array(z.object({ text: z.string().nullish(), content: z.string().nullish() })).nullish(),
  createdAt: z.number().nullish(),
  salaryRange: z
    .object({
      min: z.number().nullish(),
      max: z.number().nullish(),
      currency: z.string().nullish(),
      interval: z.string().nullish(),
    })
    .nullish(),
});

const WORKPLACE: Record<string, JobRemote> = {
  remote: 'remote',
  hybrid: 'hybrid',
  'on-site': 'onsite',
};

/** Lever's public postings API: https://api.lever.co/v0/postings/{company}?mode=json */
export const lever: Connector<z.infer<typeof configSchema>> = {
  type: 'lever',
  configSchema,
  async fetch(config, ctx) {
    const url = `https://api.lever.co/v0/postings/${encodeURIComponent(config.company)}?mode=json`;
    const body = await ctx.http.getJson(url);
    if (!Array.isArray(body)) throw unavailable('Lever sent an answer jobowl does not recognise.');
    return collect(body as unknown[], job, (item) => {
      const where = item.categories?.location ?? item.categories?.allLocations?.[0] ?? null;
      const plain = item.descriptionPlain ?? htmlToText(item.description ?? '');
      const sections = (item.lists ?? []).map(
        (l) => `${l.text ?? ''}\n${htmlToText(l.content ?? '')}`,
      );
      const mode = WORKPLACE[item.workplaceType ?? ''];
      const pay = item.salaryRange;
      return {
        externalId: item.id,
        url: item.hostedUrl,
        applyUrl: item.applyUrl ?? item.hostedUrl,
        applyKind: 'lever_form',
        company: ctx.label,
        title: item.text,
        location: where,
        remoteMode: mode ?? inferRemote(where, item.text),
        employmentType: item.categories?.commitment ?? null,
        salaryMin: pay?.min != null ? toYearly(pay.min, pay.interval) : null,
        salaryMax: pay?.max != null ? toYearly(pay.max, pay.interval) : null,
        salaryCurrency: pay?.currency ?? null,
        description: [plain, ...sections, item.additionalPlain ?? ''].filter(Boolean).join('\n\n'),
        postedAt: isoFromMs(item.createdAt),
      };
    });
  },
};
