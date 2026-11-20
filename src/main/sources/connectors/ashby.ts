import { z } from 'zod';
import type { JobRemote } from '@shared/schemas/discovery';
import { collect, type Connector } from '../connector';
import { unavailable } from '../errors';
import { htmlToText, inferRemote, isoFromText, parseSalaryText } from '../normalise';

const configSchema = z.object({ board: z.string().min(1).max(100) });
const response = z.object({ jobs: z.array(z.unknown()) });
const job = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  jobUrl: z.string().min(1),
  applyUrl: z.string().nullish(),
  location: z.string().nullish(),
  isListed: z.boolean().nullish(),
  isRemote: z.boolean().nullish(),
  workplaceType: z.string().nullish(),
  employmentType: z.string().nullish(),
  descriptionPlain: z.string().nullish(),
  descriptionHtml: z.string().nullish(),
  publishedAt: z.string().nullish(),
  compensation: z.object({ compensationTierSummary: z.string().nullish() }).nullish(),
});

const WORKPLACE: Record<string, JobRemote> = {
  remote: 'remote',
  hybrid: 'hybrid',
  onsite: 'onsite',
};

/** Ashby's public job board API: https://api.ashbyhq.com/posting-api/job-board/{board} */
export const ashby: Connector<z.infer<typeof configSchema>> = {
  type: 'ashby',
  configSchema,
  async fetch(config, ctx) {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(config.board)}?includeCompensation=true`;
    const body = response.safeParse(await ctx.http.getJson(url));
    if (!body.success) throw unavailable('Ashby sent an answer jobowl does not recognise.');
    return collect(body.data.jobs, job, (item) => {
      if (item.isListed === false) return null;
      const pay = parseSalaryText(item.compensation?.compensationTierSummary);
      const mode = WORKPLACE[(item.workplaceType ?? '').toLowerCase()];
      return {
        externalId: item.id,
        url: item.jobUrl,
        applyUrl: item.applyUrl ?? item.jobUrl,
        applyKind: 'ashby_form',
        company: ctx.label,
        title: item.title,
        location: item.location ?? null,
        remoteMode: mode ?? (item.isRemote ? 'remote' : inferRemote(item.location, item.title)),
        employmentType: item.employmentType ?? null,
        salaryMin: pay?.min ?? null,
        salaryMax: pay?.max ?? null,
        salaryCurrency: pay?.currency ?? null,
        description: item.descriptionPlain ?? htmlToText(item.descriptionHtml ?? ''),
        postedAt: isoFromText(item.publishedAt),
      };
    });
  },
};
