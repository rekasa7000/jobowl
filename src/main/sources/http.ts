import { blocked, rateLimited, unavailable } from './errors';

const MAX_BYTES = 20 * 1024 * 1024;

export interface Http {
  getJson(url: string, headers?: Record<string, string>): Promise<unknown>;
}

export interface HttpDeps {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  userAgent: string;
  /** Milliseconds between requests to one host. 2000 is 30 a minute. */
  hostGapMs?: number;
  attempts?: number;
  /** Only used to point tests at a local server. */
  rewrite?: (url: string) => string;
}

/**
 * The one way jobowl fetches from the web. Every request carries an honest User-Agent, is spaced
 * per host, backs off on 429 and 5xx, and treats a 403 as a "no" instead of looking for a way in.
 */
export function createHttp(deps: HttpDeps): Http {
  const doFetch = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
  const now = deps.now ?? Date.now;
  const gap = deps.hostGapMs ?? 2000;
  const attempts = deps.attempts ?? 3;
  const nextSlot = new Map<string, number>();

  async function pace(host: string): Promise<void> {
    const wait = (nextSlot.get(host) ?? 0) - now();
    nextSlot.set(host, Math.max(now(), nextSlot.get(host) ?? 0) + gap);
    if (wait > 0) await sleep(wait);
  }

  return {
    async getJson(rawUrl, headers = {}) {
      const url = deps.rewrite ? deps.rewrite(rawUrl) : rawUrl;
      const host = new URL(url).host;
      let lastProblem = 'No answer.';

      for (let attempt = 1; attempt <= attempts; attempt++) {
        await pace(host);
        let response: Response;
        try {
          response = await doFetch(url, {
            headers: { 'user-agent': deps.userAgent, accept: 'application/json', ...headers },
            signal: AbortSignal.timeout(30_000),
          });
        } catch {
          lastProblem = `Couldn't reach ${host}.`;
          if (attempt < attempts) await sleep(1000 * 2 ** (attempt - 1));
          continue;
        }

        if (response.status === 401 || response.status === 403) {
          throw blocked(
            `${host} refused the request (${String(response.status)}). jobowl doesn't work around that.`,
          );
        }
        if (response.status === 404)
          throw unavailable(`${host} has no board at that address (404).`);
        if (response.status === 429 || response.status >= 500) {
          lastProblem =
            response.status === 429
              ? `${host} asked jobowl to slow down.`
              : `${host} had a problem (${String(response.status)}).`;
          const retryAfter = Number(response.headers.get('retry-after'));
          const delay =
            Number.isFinite(retryAfter) && retryAfter > 0
              ? Math.min(retryAfter, 30) * 1000
              : 1000 * 2 ** (attempt - 1);
          if (attempt < attempts) await sleep(delay);
          if (attempt === attempts && response.status === 429) throw rateLimited(lastProblem);
          continue;
        }
        if (!response.ok) throw unavailable(`${host} answered ${String(response.status)}.`);

        const text = await response.text();
        if (text.length > MAX_BYTES)
          throw unavailable(`${host} sent more data than jobowl accepts.`);
        try {
          return JSON.parse(text) as unknown;
        } catch {
          throw unavailable(`${host} didn't send JSON. The address may be wrong.`);
        }
      }
      throw unavailable(lastProblem);
    },
  };
}
