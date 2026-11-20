# Job sources

Where jobs come from, and the rules for getting them. The policy is in [ADR 0003](adr/0003-job-sources-policy.md): official APIs and structured data first; never scrape a site whose terms forbid it; never evade blocking.

## Connector interface

```ts
interface SourceConnector<Config> {
  readonly type: string;                   // 'greenhouse'
  readonly label: string;                  // 'Greenhouse job board'
  readonly configSchema: ZodType<Config>;
  readonly needsKey?: string;              // secret name, if the API needs a key
  readonly rateLimit: { requestsPerMinute: number };
  /** Yield normalised jobs. Throw typed errors; never swallow them. */
  fetch(config: Config, ctx: FetchContext): AsyncIterable<NormalisedJob>;
  /** Optional: check a config before saving (board exists, key valid). */
  validate?(config: Config, ctx: FetchContext): Promise<ValidationResult>;
}
```

`FetchContext` provides the HTTP client (with User-Agent, timeouts, per-host rate limiting, robots.txt cache), an abort signal and a logger. Connectors never create their own HTTP clients.

`NormalisedJob` is the `jobs` row minus local fields (see [DATA_MODEL.md](DATA_MODEL.md#jobs)). HTML descriptions are sanitised and converted to Markdown inside the connector.

## Built-in connectors

### Applicant tracking system boards (company-specific)

Many companies publish their openings through ATS job boards with public, documented, read-only JSON endpoints. These are the best sources: complete, structured, legal, and they link straight to forms jobowl can fill.

| Connector | Endpoint (public, no key) | Config | Apply kind |
|---|---|---|---|
| `greenhouse` | `boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true` | board token | `greenhouse_form` |
| `lever` | `api.lever.co/v0/postings/{company}?mode=json` | company slug | `lever_form` |
| `ashby` | `api.ashbyhq.com/posting-api/job-board/{board}?includeCompensation=true` | board name | `ashby_form` |
| `workable` | public account widget endpoint | subdomain | `generic_form` |
| `smartrecruiters` | `api.smartrecruiters.com/v1/companies/{id}/postings` | company id | `generic_form` |

Endpoint details are confirmed against each provider's current public docs when the connector is built; the connector's fixtures record the real response shape.

Users add companies by pasting a careers URL. jobowl recognises the ATS from the URL (`boards.greenhouse.io/acme`, `jobs.lever.co/acme`, `jobs.ashbyhq.com/acme`) and creates the source. jobowl ships with no preloaded company list: what to watch is the user's choice.

### Aggregators (search-based)

| Connector | Access | Notes |
|---|---|---|
| `remotive` | Public API | Remote jobs. Their terms ask for attribution and limited polling; we link back and poll at most every 6 hours. |
| `remoteok` | Public API | Requires a link back to the original posting; we always show and use the original URL. |
| `arbeitnow` | Public API | |
| `adzuna` | Free API key | Many countries; user enters app id and key. Search parameters come from the user's searches. |

Aggregator results often link to an ATS. When an `apply_url` resolves to a Greenhouse, Lever or Ashby posting, jobowl sets the matching `apply_kind` so the form can be filled.

### Status in M3

Built: `greenhouse`, `lever`, `ashby`, `remotive`, `remoteok`, `arbeitnow`, `adzuna`. Not built: `workable`, `smartrecruiters`, `careers_page`, `web_search` (M7). Fixtures follow the documented shapes and have not been checked against live responses. A response in an unknown shape is reported as such instead of producing partial data, and an entry that doesn't parse is counted and skipped. Posting HTML is converted to plain text and always shown as text. Jobs a source stops listing for three days are marked closed.

### Career pages (`careers_page`)

For companies not on a supported ATS. The user adds the URL of a careers page.

1. Check robots.txt for the page; if disallowed, the source is saved as `blocked` with an explanation.
2. Fetch with plain HTTP. If the page has schema.org `JobPosting` JSON-LD (many do, for Google Jobs), use it directly. No AI needed.
3. If not, look for an embedded ATS (Greenhouse/Lever/Ashby iframe or script) and switch to that connector.
4. Otherwise convert the page to Markdown and let the Extractor layer find job links and details. Follow job links on the same host only, at most 30 per run.
5. Pages that need JavaScript to render are fetched with Playwright in a headless Edge context, under the same robots and rate rules.

### Web search discovery (`web_search`, optional)

Finds postings across many companies without the user listing them, by searching for ATS-hosted postings: `site:boards.greenhouse.io "frontend engineer" remote`, `site:jobs.lever.co …`, `site:jobs.ashbyhq.com …`. Queries are built from the user's searches.

- Needs a search API the user chooses and pays for (for example Brave Search API, or the web search tool of their AI provider when it has one). Off by default.
- Results are only used when they resolve to a supported ATS posting; jobowl then fetches the posting through that ATS's public API, not by scraping the search result.
- Discovered companies are offered to the user as new sources ("Add Acme's Greenhouse board?").

This is how "the AI searches the web for jobs" works without breaking anyone's terms.

## What jobowl won't fetch

These sites prohibit automated access in their terms and actively block it. jobowl has no connector for them and won't merge one:

- LinkedIn, Indeed, Glassdoor, ZipRecruiter, JobStreet, Monster, and similar boards.

If a user pastes a posting URL from one of them, jobowl offers **Import manually**: open the page in the user's normal browser, copy the description, paste it into jobowl. The job is then scored and tailored like any other; applying is done by hand.

## Fetch etiquette

Applies to every connector, enforced by the shared HTTP client, not left to each connector:

- User-Agent: `jobowl/<version> (+https://github.com/rekasa7000/jobowl)`. Honest, no browser impersonation.
- robots.txt is fetched and respected for non-API page fetches. The M3 connectors only call documented public APIs, so this arrives with `careers_page`.
- Per-host rate limit (default 30 requests/minute, lower when a source's terms say so) and at most 4 hosts fetched in parallel.
- Conditional requests (`If-None-Match` / `If-Modified-Since`) where supported.
- Backoff on 429 and 5xx, honouring `Retry-After`. Three failed attempts in one fetch end that source's fetch for the run; it is tried again next run.
- 403, CAPTCHA pages and bot challenges are treated as "this site doesn't want us": the source is marked `blocked` and not retried automatically. No workarounds.
- Timeouts: 15 s connect, 30 s total per request.

## Normalisation

Done in each connector, checked by shared code:

- **Remote mode:** from explicit fields first, then location text ("Remote", "Anywhere", "Hybrid – Manila"), else `unknown`.
- **Salary:** parsed into min/max/currency/period, converted to yearly. Unknown stays null; never guessed.
- **Location:** kept as text plus a parsed country code when obvious.
- **Description:** sanitised HTML (allowlist of tags) → Markdown. Scripts, styles, tracking pixels and iframes dropped.
- **Contact email:** extracted from the description only when it appears in an application context ("send your CV to …"). Generic `info@` or `privacy@` addresses are ignored.
- **Posted date:** from the source; if missing, `first_seen_at` is used for age filtering.

## Adding a source

1. Check the site's terms of service and robots.txt. If automated access is prohibited, stop.
2. Prefer an official API or feed. Document the endpoint and its terms in the connector's README.
3. Create `src/main/sources/<type>/` with `connector.ts`, `config.ts` (Zod), `README.md` and `fixtures/` (recorded real responses, scrubbed of anything personal).
4. Write tests against the fixtures: normalisation, pagination, error mapping. No live network in tests.
5. Register it in `src/main/sources/registry.ts` and add it to the table above.
