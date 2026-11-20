import { createHash } from 'node:crypto';
import type { JobRemote } from '@shared/schemas/discovery';

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X'))
      return String.fromCodePoint(parseInt(body.slice(2), 16));
    if (body.startsWith('#')) return String.fromCodePoint(parseInt(body.slice(1), 10));
    return NAMED[body.toLowerCase()] ?? whole;
  });
}

/**
 * Plain text from a posting's HTML. It is only ever shown as text and read by a model, never
 * rendered as HTML, so this keeps the structure (paragraphs, lists) and drops everything else.
 */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|ul|ol|tr)>/gi, '\n\n')
      .replace(/<li[^>]*>/gi, '\n- ')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function inferRemote(...texts: (string | null | undefined)[]): JobRemote {
  const text = texts.filter(Boolean).join(' ').toLowerCase();
  if (/\bhybrid\b/.test(text)) return 'hybrid';
  if (/\b(remote|anywhere|work from home|distributed)\b/.test(text)) return 'remote';
  if (/\b(on-?site|in[- ]office|in[- ]person)\b/.test(text)) return 'onsite';
  return 'unknown';
}

export interface Salary {
  min: number | null;
  max: number | null;
  currency: string | null;
}

const SYMBOLS: Record<string, string> = {
  $: 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '₱': 'PHP',
  '¥': 'JPY',
};

/** Reads text like "$80k - $100k" or "€70,000 to €90,000" as a yearly range. Unclear text gives nothing. */
export function parseSalaryText(text: string | null | undefined): Salary | null {
  if (!text) return null;
  const symbol = /[$€£₱¥]/.exec(text)?.[0];
  const code = /\b(USD|EUR|GBP|PHP|CAD|AUD|SGD|INR)\b/.exec(text)?.[1];
  const numbers = [...text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*([kK])?/g)].map((m) => {
    const value = parseFloat((m[1] ?? '').replace(/,/g, ''));
    return m[2] ? value * 1000 : value;
  });
  const yearly = numbers.filter((n) => n >= 10_000);
  if (yearly.length === 0 || /\b(hour|hr|month|week|day)\b/i.test(text)) return null;
  const min = Math.min(...yearly);
  const max = Math.max(...yearly);
  return { min, max, currency: code ?? (symbol ? (SYMBOLS[symbol] ?? null) : null) };
}

/** A structured pay range to a yearly figure. Hourly and monthly rates are scaled up. */
export function toYearly(amount: number, interval: string | null | undefined): number {
  const unit = (interval ?? '').toLowerCase();
  if (unit.includes('hour')) return Math.round(amount * 2080);
  if (unit.includes('month')) return Math.round(amount * 12);
  if (unit.includes('week')) return Math.round(amount * 52);
  return Math.round(amount);
}

/** The same posting often reaches jobowl twice with different tracking parameters. */
export function canonicalUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.hash = '';
    url.search = '';
    url.hostname = url.hostname.replace(/^www\./, '').toLowerCase();
    return url.toString().replace(/\/$/, '');
  } catch {
    return raw.trim().toLowerCase();
  }
}

export function contentHash(title: string, description: string): string {
  return createHash('sha256').update(`${title}\n${description}`).digest('hex').slice(0, 32);
}

export function isoFromMs(ms: number | null | undefined): string | null {
  return typeof ms === 'number' && Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export function isoFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const time = Date.parse(text);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

export function prettify(token: string): string {
  return token
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}
