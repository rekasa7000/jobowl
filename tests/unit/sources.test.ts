import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SourceType } from '@shared/schemas/discovery';
import type { FetchContext } from '../../src/main/sources/connector';
import { createHttp, type Http } from '../../src/main/sources/http';
import { connectors, detectSource } from '../../src/main/sources/registry';
import {
  canonicalUrl,
  decodeEntities,
  htmlToText,
  inferRemote,
  parseSalaryText,
  toYearly,
} from '../../src/main/sources/normalise';

const fixture = (type: string): unknown =>
  JSON.parse(
    readFileSync(join(import.meta.dirname, '../fixtures/sources', type, 'jobs.json'), 'utf8'),
  );

function ctxFor(
  type: string,
  extra: Partial<FetchContext> = {},
): { ctx: FetchContext; urls: string[] } {
  const urls: string[] = [];
  const http: Http = {
    getJson: (url) => {
      urls.push(url);
      return Promise.resolve(fixture(type));
    },
  };
  return {
    urls,
    ctx: {
      http,
      label: 'Acme',
      queries: ['frontend engineer'],
      secret: () => Promise.resolve('app-key'),
      ...extra,
    },
  };
}

async function run(
  type: SourceType,
  config: Record<string, string>,
  extra?: Partial<FetchContext>,
) {
  const { ctx, urls } = ctxFor(type, extra);
  const result = await connectors[type].fetch(config, ctx);
  return { ...result, urls };
}

describe('normalise', () => {
  it('turns HTML into readable text with list markers and paragraph breaks', () => {
    expect(
      htmlToText(
        '<p>We build <b>maps</b>.</p><ul><li>React</li><li>Go</li></ul><script>x()</script>',
      ),
    ).toBe('We build maps.\n\n- React\n- Go');
  });

  it('decodes named and numeric entities, once', () => {
    expect(decodeEntities('Ben &amp; Jerry&#39;s &#x2764; &lt;3 &amp;amp;')).toBe(
      "Ben & Jerry's ❤ <3 &amp;",
    );
  });

  it.each([
    ['Remote - Philippines', 'remote'],
    ['London (Hybrid)', 'hybrid'],
    ['On-site in Manila', 'onsite'],
    ['Manila', 'unknown'],
  ])('reads %j as %s', (text, expected) => expect(inferRemote(text)).toBe(expected));

  it.each([
    ['$150K – $180K • Offers Equity', { min: 150000, max: 180000, currency: 'USD' }],
    ['€70,000 to €90,000', { min: 70000, max: 90000, currency: 'EUR' }],
    ['£45k', { min: 45000, max: 45000, currency: 'GBP' }],
  ])('reads the salary %j', (text, expected) => expect(parseSalaryText(text)).toEqual(expected));

  it.each(['', 'Competitive', '$25 per hour', '$5,000 a month'])(
    'refuses to guess a salary from %j',
    (text) => {
      expect(parseSalaryText(text)).toBeNull();
    },
  );

  it('scales hourly and monthly pay to a year', () => {
    expect(toYearly(25, 'per-hour-wage')).toBe(52000);
    expect(toYearly(5000, 'per-month-salary')).toBe(60000);
    expect(toYearly(90000, 'per-year-salary')).toBe(90000);
  });

  it('treats the same posting with different tracking as one address', () => {
    expect(canonicalUrl('https://WWW.Example.com/jobs/1/?utm_source=x#apply')).toBe(
      canonicalUrl('https://example.com/jobs/1'),
    );
  });
});

describe('detectSource', () => {
  it.each([
    ['https://boards.greenhouse.io/acme', 'greenhouse', { board: 'acme' }, 'Acme'],
    ['job-boards.greenhouse.io/some-co/jobs/123', 'greenhouse', { board: 'some-co' }, 'Some Co'],
    ['https://jobs.lever.co/acme/abc-123', 'lever', { company: 'acme' }, 'Acme'],
    ['https://jobs.ashbyhq.com/acme', 'ashby', { board: 'acme' }, 'Acme'],
    ['https://remoteok.com/', 'remoteok', {}, 'RemoteOK'],
  ])('recognises %s', (url, type, config, label) => {
    expect(detectSource(url)).toEqual({ type, config, label });
  });

  it('gives nothing for a page it cannot read, including sites that forbid automated access', () => {
    expect(detectSource('https://www.linkedin.com/jobs/view/123')).toBeNull();
    expect(detectSource('https://acme.com/careers')).toBeNull();
    expect(detectSource('not a url at all')).toBeNull();
  });
});

describe('connectors', () => {
  it('greenhouse: reads the board, unescapes the content and skips an entry with no link', async () => {
    const { jobs, skipped, urls } = await run('greenhouse', { board: 'acme' });
    expect(urls).toEqual(['https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true']);
    expect(skipped).toBe(1);
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      externalId: '4001',
      company: 'Acme',
      title: 'Senior Frontend Engineer',
      remoteMode: 'remote',
      applyKind: 'greenhouse_form',
      postedAt: '2025-05-20T13:00:00.000Z',
    });
    expect(jobs[0]?.description).toBe(
      'We build maps.\n\n- 5+ years of React\n- TypeScript\n\nBen&Jerry & co',
    );
    expect(jobs[1]?.remoteMode).toBe('hybrid');
  });

  it('lever: uses the workplace type and pay range, scaling hourly pay to a year', async () => {
    const { jobs, skipped, urls } = await run('lever', { company: 'acme' });
    expect(urls[0]).toBe('https://api.lever.co/v0/postings/acme?mode=json');
    expect(skipped).toBe(1);
    expect(jobs[0]).toMatchObject({
      remoteMode: 'remote',
      salaryMin: 90000,
      salaryMax: 120000,
      salaryCurrency: 'USD',
      applyKind: 'lever_form',
    });
    expect(jobs[0]?.description).toContain('Run the platform.');
    expect(jobs[0]?.description).toContain('- Kubernetes');
    expect(jobs[0]?.description).toContain('equal opportunity');
    expect(jobs[1]).toMatchObject({ remoteMode: 'onsite', salaryMin: 41600, salaryMax: 52000 });
  });

  it('ashby: skips unlisted roles and reads the compensation summary', async () => {
    const { jobs, skipped } = await run('ashby', { board: 'acme' });
    expect(skipped).toBe(1);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      remoteMode: 'remote',
      salaryMin: 150000,
      salaryMax: 180000,
      salaryCurrency: 'USD',
      employmentType: 'FullTime',
    });
  });

  it('remotive: searches by the titles you want and treats everything as remote', async () => {
    const { jobs, urls } = await run('remotive', {}, { queries: ['frontend engineer', 'react'] });
    expect(urls).toEqual([
      'https://remotive.com/api/remote-jobs?search=frontend%20engineer',
      'https://remotive.com/api/remote-jobs?search=react',
    ]);
    expect(jobs).toHaveLength(2); // the same two jobs came back for both searches
    expect(jobs[0]).toMatchObject({
      company: 'Globex',
      remoteMode: 'remote',
      salaryMin: 80000,
      salaryMax: 100000,
    });
    expect(jobs[1]?.salaryMin).toBeNull();
  });

  it('remoteok: ignores the legal notice and treats a zero salary as unknown', async () => {
    const { jobs, skipped } = await run('remoteok', {});
    expect(skipped).toBe(0);
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({ salaryMin: 100000, salaryCurrency: 'USD' });
    expect(jobs[1]).toMatchObject({ salaryMin: null, salaryCurrency: null });
  });

  it('arbeitnow: reads the remote flag and the unix timestamp', async () => {
    const { jobs } = await run('arbeitnow', {});
    expect(jobs[0]).toMatchObject({ remoteMode: 'unknown', postedAt: '2025-06-02T21:33:20.000Z' });
    expect(jobs[1]?.remoteMode).toBe('remote');
  });

  it('adzuna: sends the key from the encrypted store and labels the currency by country', async () => {
    const { jobs, urls } = await run('adzuna', { country: 'gb', appId: 'id1' });
    expect(urls[0]).toContain('/jobs/gb/search/1?app_id=id1&app_key=app-key');
    expect(urls[0]).toContain('what=frontend%20engineer');
    expect(jobs[0]).toMatchObject({
      company: 'Umbrella Ltd',
      salaryCurrency: 'GBP',
      salaryMin: 65000,
    });
    expect(jobs[1]?.salaryCurrency).toBeNull();
  });

  it('adzuna: says what to do when no key is saved', async () => {
    await expect(
      run('adzuna', { country: 'gb', appId: 'id1' }, { secret: () => Promise.resolve(null) }),
    ).rejects.toThrow(/app key in Settings/);
  });

  it.each(['greenhouse', 'lever', 'ashby', 'arbeitnow'] as const)(
    '%s: reports a response in an unknown shape',
    async (type) => {
      const http: Http = { getJson: () => Promise.resolve('not what we expected') };
      const config =
        type === 'lever' ? { company: 'x' } : type === 'arbeitnow' ? {} : { board: 'x' };
      await expect(
        connectors[type].fetch(config, {
          http,
          label: 'x',
          queries: [],
          secret: () => Promise.resolve(null),
        }),
      ).rejects.toThrow(/does not recognise/);
    },
  );
});

describe('http client', () => {
  const reply = (status: number, body = '{"ok":true}', headers: Record<string, string> = {}) =>
    new Response(body, { status, headers });

  function client(responses: (Response | Error)[], gap = 0) {
    const sleeps: number[] = [];
    const calls: { url: string; ua: string | null }[] = [];
    const http = createHttp({
      userAgent: 'JobOwl/test (+https://example.test)',
      hostGapMs: gap,
      sleep: (ms) => {
        sleeps.push(ms);
        return Promise.resolve();
      },
      fetch: ((url: string, init: RequestInit) => {
        calls.push({ url, ua: new Headers(init.headers).get('user-agent') });
        const next = responses.shift() ?? reply(500);
        return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
      }) as typeof fetch,
    });
    return { http, sleeps, calls };
  }

  it('identifies itself honestly and returns the JSON', async () => {
    const { http, calls } = client([reply(200)]);
    expect(await http.getJson('https://example.test/a')).toEqual({ ok: true });
    expect(calls[0]?.ua).toBe('JobOwl/test (+https://example.test)');
  });

  it('waits Retry-After on a 429, then succeeds', async () => {
    const { http, sleeps } = client([reply(429, '', { 'retry-after': '3' }), reply(200)]);
    expect(await http.getJson('https://example.test/a')).toEqual({ ok: true });
    expect(sleeps).toContain(3000);
  });

  it('gives up after repeated 429s with a rate-limited error', async () => {
    const { http } = client([reply(429), reply(429), reply(429)]);
    await expect(http.getJson('https://example.test/a')).rejects.toMatchObject({
      status: 'rate_limited',
    });
  });

  it('retries a 503 with growing waits, and reports an outage after three tries', async () => {
    const { http, sleeps } = client([reply(503), reply(503), reply(503)]);
    await expect(http.getJson('https://example.test/a')).rejects.toMatchObject({ status: 'error' });
    expect(sleeps.filter((ms) => ms >= 1000)).toEqual([1000, 2000]);
  });

  it('treats a 403 as a no and does not retry', async () => {
    const { http, calls } = client([reply(403), reply(200)]);
    await expect(http.getJson('https://example.test/a')).rejects.toMatchObject({
      status: 'blocked',
    });
    expect(calls).toHaveLength(1);
  });

  it('explains a 404 and a non-JSON answer in plain words', async () => {
    await expect(client([reply(404)]).http.getJson('https://example.test/a')).rejects.toThrow(
      /no board at that address/,
    );
    await expect(
      client([reply(200, '<html>')]).http.getJson('https://example.test/a'),
    ).rejects.toThrow(/didn't send JSON/);
  });

  it('retries a network failure and then names the host', async () => {
    const { http } = client([new Error('down'), new Error('down'), new Error('down')]);
    await expect(http.getJson('https://example.test/a')).rejects.toThrow(
      /Couldn't reach example.test/,
    );
  });

  it('spaces requests to the same host but not to different ones', async () => {
    const { http, sleeps } = client([reply(200), reply(200), reply(200)], 2000);
    await http.getJson('https://a.test/1');
    await http.getJson('https://a.test/2');
    await http.getJson('https://b.test/1');
    expect(sleeps.filter((ms) => ms > 0)).toHaveLength(1);
  });
});
