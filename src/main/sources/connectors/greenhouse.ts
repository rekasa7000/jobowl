import { z } from 'zod';
import { collect, type Connector } from '../connector';
import { unavailable } from '../errors';
import { decodeEntities, htmlToText, inferRemote, isoFromText } from '../normalise';

const configSchema = z.object({ board: z.string().min(1).max(100) });
const response = z.object({ jobs: z.array(z.unknown()) });
const job = z.object({
  id: z.union([z.number(), z.string()]),
  title: z.string().min(1),
  absolute_url: z.string().min(1),
  location: z.object({ name: z.string() }).nullish(),
  content: z.string().nullish(),
  updated_at: z.string().nullish(),
  first_published: z.string().nullish(),
});

/** Greenhouse's public job board API: https://boards-api.greenhouse.io/v1/boards/{board}/jobs */
export const greenhouse: Connector<z.infer<typeof configSchema>> = {
  type: 'greenhouse',
  configSchema,
  async fetch(config, ctx) {
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(config.board)}/jobs?content=true`;
    const body = response.safeParse(await ctx.http.getJson(url));
    if (!body.success) throw unavailable('Greenhouse sent an answer jobowl does not recognise.');
    return collect(body.data.jobs, job, (item) => ({
      externalId: String(item.id),
      url: item.absolute_url,
      applyUrl: item.absolute_url,
      applyKind: 'greenhouse_form',
      company: ctx.label,
      title: item.title,
      location: item.location?.name ?? null,
      remoteMode: inferRemote(item.location?.name, item.title),
      employmentType: null,
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      // The content arrives as HTML that has itself been entity-escaped.
      description: htmlToText(decodeEntities(item.content ?? '')),
      postedAt: isoFromText(item.first_published ?? item.updated_at),
    }));
  },
};
