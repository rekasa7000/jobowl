import { z } from 'zod';
import { collect, type Connector, type FetchResult, type NormalisedJob } from '../connector';
import { unavailable } from '../errors';
import { htmlToText, inferRemote, isoFromMs, isoFromText, parseSalaryText } from '../normalise';

const none = z.object({});

function merge(parts: FetchResult[]): FetchResult {
  const seen = new Set<string>();
  const jobs: NormalisedJob[] = [];
  for (const part of parts) {
    for (const job of part.jobs) {
      if (!seen.has(job.externalId)) {
        seen.add(job.externalId);
        jobs.push(job);
      }
    }
  }
  return { jobs, skipped: parts.reduce((total, part) => total + part.skipped, 0) };
}

const remotiveJob = z.object({
  id: z.union([z.number(), z.string()]),
  url: z.string().min(1),
  title: z.string().min(1),
  company_name: z.string().min(1),
  publication_date: z.string().nullish(),
  candidate_required_location: z.string().nullish(),
  job_type: z.string().nullish(),
  salary: z.string().nullish(),
  description: z.string().nullish(),
});

/** Remotive's public API (remote jobs): https://remotive.com/api/remote-jobs */
export const remotive: Connector<z.infer<typeof none>> = {
  type: 'remotive',
  configSchema: none,
  async fetch(_config, ctx) {
    // Remotive asks for modest use, so at most three searches, one request each.
    const parts: FetchResult[] = [];
    for (const query of ctx.queries.slice(0, 3)) {
      const body = z
        .object({ jobs: z.array(z.unknown()) })
        .safeParse(
          await ctx.http.getJson(
            `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}`,
          ),
        );
      if (!body.success) throw unavailable('Remotive sent an answer jobowl does not recognise.');
      parts.push(
        collect(body.data.jobs, remotiveJob, (item) => {
          const pay = parseSalaryText(item.salary);
          return {
            externalId: String(item.id),
            url: item.url,
            applyUrl: item.url,
            applyKind: 'external',
            company: item.company_name,
            title: item.title,
            location: item.candidate_required_location ?? null,
            remoteMode: 'remote',
            employmentType: item.job_type ?? null,
            salaryMin: pay?.min ?? null,
            salaryMax: pay?.max ?? null,
            salaryCurrency: pay?.currency ?? null,
            description: htmlToText(item.description ?? ''),
            postedAt: isoFromText(item.publication_date),
          };
        }),
      );
    }
    return merge(parts);
  },
};

const remoteOkJob = z.object({
  id: z.union([z.number(), z.string()]),
  url: z.string().min(1),
  position: z.string().min(1),
  company: z.string().min(1),
  location: z.string().nullish(),
  description: z.string().nullish(),
  date: z.string().nullish(),
  salary_min: z.number().nullish(),
  salary_max: z.number().nullish(),
  apply_url: z.string().nullish(),
});

/** RemoteOK's public feed. The first entry is a legal notice, not a job; it fails the check and is skipped. */
export const remoteok: Connector<z.infer<typeof none>> = {
  type: 'remoteok',
  configSchema: none,
  async fetch(_config, ctx) {
    const body = await ctx.http.getJson('https://remoteok.com/api');
    if (!Array.isArray(body))
      throw unavailable('RemoteOK sent an answer jobowl does not recognise.');
    const result = collect((body as unknown[]).slice(1), remoteOkJob, (item) => ({
      externalId: String(item.id),
      // RemoteOK requires a link back to the posting on its own site.
      url: item.url,
      applyUrl: item.apply_url ?? item.url,
      applyKind: 'external',
      company: item.company,
      title: item.position,
      location: item.location ?? null,
      remoteMode: 'remote',
      employmentType: null,
      salaryMin: item.salary_min && item.salary_min > 0 ? item.salary_min : null,
      salaryMax: item.salary_max && item.salary_max > 0 ? item.salary_max : null,
      salaryCurrency: item.salary_min && item.salary_min > 0 ? 'USD' : null,
      description: htmlToText(item.description ?? ''),
      postedAt: isoFromText(item.date),
    }));
    return result;
  },
};

const arbeitnowJob = z.object({
  slug: z.string().min(1),
  company_name: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullish(),
  remote: z.boolean().nullish(),
  url: z.string().min(1),
  location: z.string().nullish(),
  job_types: z.array(z.string()).nullish(),
  created_at: z.number().nullish(),
});

/** Arbeitnow's public job board API. */
export const arbeitnow: Connector<z.infer<typeof none>> = {
  type: 'arbeitnow',
  configSchema: none,
  async fetch(_config, ctx) {
    const body = z
      .object({ data: z.array(z.unknown()) })
      .safeParse(await ctx.http.getJson('https://www.arbeitnow.com/api/job-board-api'));
    if (!body.success) throw unavailable('Arbeitnow sent an answer jobowl does not recognise.');
    return collect(body.data.data, arbeitnowJob, (item) => ({
      externalId: item.slug,
      url: item.url,
      applyUrl: item.url,
      applyKind: 'external',
      company: item.company_name,
      title: item.title,
      location: item.location ?? null,
      remoteMode: item.remote ? 'remote' : inferRemote(item.location, item.title),
      employmentType: item.job_types?.[0] ?? null,
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      description: htmlToText(item.description ?? ''),
      postedAt: isoFromMs(item.created_at != null ? item.created_at * 1000 : null),
    }));
  },
};

const adzunaConfig = z.object({
  country: z.string().regex(/^[a-z]{2}$/, 'Use a two-letter country code such as gb or us'),
  appId: z.string().min(1).max(100),
});
const adzunaJob = z.object({
  id: z.union([z.number(), z.string()]),
  title: z.string().min(1),
  redirect_url: z.string().min(1),
  description: z.string().nullish(),
  created: z.string().nullish(),
  salary_min: z.number().nullish(),
  salary_max: z.number().nullish(),
  contract_type: z.string().nullish(),
  company: z.object({ display_name: z.string().nullish() }).nullish(),
  location: z.object({ display_name: z.string().nullish() }).nullish(),
});
const CURRENCY: Record<string, string> = {
  gb: 'GBP',
  us: 'USD',
  au: 'AUD',
  ca: 'CAD',
  de: 'EUR',
  fr: 'EUR',
  nl: 'EUR',
  it: 'EUR',
  es: 'EUR',
  at: 'EUR',
  in: 'INR',
  sg: 'SGD',
};

/** Adzuna's search API. Needs a free app id (in the source) and key (stored encrypted). */
export const adzuna: Connector<z.infer<typeof adzunaConfig>> = {
  type: 'adzuna',
  configSchema: adzunaConfig,
  async fetch(config, ctx) {
    const key = await ctx.secret('adzuna_app_key');
    if (!key) throw unavailable('Add your Adzuna app key in Settings first.');
    const parts: FetchResult[] = [];
    for (const query of ctx.queries.slice(0, 3)) {
      const url =
        `https://api.adzuna.com/v1/api/jobs/${config.country}/search/1` +
        `?app_id=${encodeURIComponent(config.appId)}&app_key=${encodeURIComponent(key)}` +
        `&results_per_page=50&what=${encodeURIComponent(query)}&content-type=application/json`;
      const body = z
        .object({ results: z.array(z.unknown()) })
        .safeParse(await ctx.http.getJson(url));
      if (!body.success) throw unavailable('Adzuna sent an answer jobowl does not recognise.');
      parts.push(
        collect(body.data.results, adzunaJob, (item) => ({
          externalId: String(item.id),
          url: item.redirect_url,
          applyUrl: item.redirect_url,
          applyKind: 'external',
          company: item.company?.display_name ?? 'Unknown company',
          title: item.title,
          location: item.location?.display_name ?? null,
          remoteMode: inferRemote(item.location?.display_name, item.title, item.description),
          employmentType: item.contract_type ?? null,
          salaryMin: item.salary_min ? Math.round(item.salary_min) : null,
          salaryMax: item.salary_max ? Math.round(item.salary_max) : null,
          salaryCurrency: item.salary_min ? (CURRENCY[config.country] ?? null) : null,
          // Adzuna returns a short snippet, not the full posting.
          description: htmlToText(item.description ?? ''),
          postedAt: isoFromText(item.created),
        })),
      );
    }
    return merge(parts);
  },
};
