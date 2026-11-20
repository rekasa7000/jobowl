import mammoth from 'mammoth';
import { extractText as pdfText, getDocumentProxy } from 'unpdf';

export const MAX_RESUME_BYTES = 10 * 1024 * 1024;
const MIN_TEXT_CHARS = 40;

export type ResumeKind = 'pdf' | 'docx' | 'txt';

/** A problem with the file itself. The message is written for the person importing it. */
export class ResumeFileError extends Error {}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

/** Decides what a file is from its first bytes, never from its name. */
export function sniffKind(bytes: Uint8Array): ResumeKind {
  if (bytes.byteLength > MAX_RESUME_BYTES) {
    throw new ResumeFileError(
      'That file is larger than 10 MB. Export a smaller copy and try again.',
    );
  }
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'pdf'; // %PDF-
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return 'docx'; // zip container
  if (!bytes.subarray(0, 4096).includes(0)) {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      return 'txt';
    } catch {
      // not valid UTF-8: fall through
    }
  }
  throw new ResumeFileError(
    'jobowl can read PDF, DOCX and plain text resumes. This file is none of those.',
  );
}

/** Collapses the blank-line and spacing noise PDF and DOCX extraction leave behind. */
function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function extractResumeText(bytes: Uint8Array): Promise<string> {
  const kind = sniffKind(bytes);
  let text: string;

  if (kind === 'pdf') {
    try {
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      text = (await pdfText(pdf, { mergePages: true })).text;
    } catch {
      throw new ResumeFileError(
        "That PDF couldn't be read. It may be damaged or password-protected.",
      );
    }
  } else if (kind === 'docx') {
    try {
      text = (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value;
    } catch {
      throw new ResumeFileError(
        "That DOCX couldn't be read. Open it in Word and save a fresh copy.",
      );
    }
  } else {
    text = new TextDecoder('utf-8').decode(bytes);
  }

  const cleaned = tidy(text);
  if (cleaned.length < MIN_TEXT_CHARS) {
    throw new ResumeFileError(
      kind === 'pdf'
        ? 'This PDF has no text in it. It looks like a scan or an image. Upload a DOCX, or paste the text instead.'
        : 'There is almost no text in this file. Check that it is the right one.',
    );
  }
  return cleaned;
}
