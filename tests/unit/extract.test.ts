import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  extractResumeText,
  MAX_RESUME_BYTES,
  ResumeFileError,
  sniffKind,
} from '../../src/main/resume/extract';

const dir = join(import.meta.dirname, '../fixtures/resumes');
const load = (name: string) => new Uint8Array(readFileSync(join(dir, name)));

describe('sniffKind', () => {
  it('recognises files by their first bytes, not their name', () => {
    expect(sniffKind(load('ada-lovelace.pdf'))).toBe('pdf');
    expect(sniffKind(load('ada-lovelace.docx'))).toBe('docx');
    expect(sniffKind(load('ada-lovelace.txt'))).toBe('txt');
  });

  it('refuses binary files that are none of the three', () => {
    expect(() => sniffKind(new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03]))).toThrow(
      ResumeFileError,
    );
    expect(() => sniffKind(new Uint8Array([0xff, 0xfe, 0xfd, 0x80]))).toThrow(
      /PDF, DOCX and plain text/,
    );
  });

  it('refuses a file over 10 MB', () => {
    expect(() => sniffKind(new Uint8Array(MAX_RESUME_BYTES + 1))).toThrow(/larger than 10 MB/);
  });
});

describe('extractResumeText', () => {
  it.each(['ada-lovelace.txt', 'ada-lovelace.docx', 'ada-lovelace.pdf'])(
    'reads the experience, numbers and contact details out of %s',
    async (name) => {
      const text = await extractResumeText(load(name));
      expect(text).toContain('Ada Lovelace');
      expect(text).toContain('ada@example.com');
      expect(text).toContain(
        'Cut run time of the Bernoulli number program by 40% across 12 machines',
      );
      expect(text).toContain('Difference Works');
    },
  );

  it('explains a PDF with no text layer instead of returning nothing', async () => {
    await expect(extractResumeText(load('scanned-no-text.pdf'))).rejects.toThrow(/no text in it/);
  });

  it('refuses an almost empty text file', async () => {
    await expect(extractResumeText(new TextEncoder().encode('hi'))).rejects.toThrow(
      /almost no text/,
    );
  });

  it('reports a damaged PDF without leaking internals', async () => {
    const broken = new TextEncoder().encode('%PDF-1.4\nthis is not really a pdf');
    await expect(extractResumeText(broken)).rejects.toThrow(/couldn't be read/);
  });

  it('reports a zip that is not a Word document', async () => {
    const notDocx = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
    await expect(extractResumeText(notDocx)).rejects.toThrow(/couldn't be read/);
  });
});
