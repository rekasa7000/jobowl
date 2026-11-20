import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { ImportDraft } from '@shared/schemas/profile';
import type { ParsedResume } from '../ai/layers/parser';
import type { SourceFile } from '../db/profile-repo';
import { ulid } from '../ids';
import type { DataPaths } from '../paths';
import { buildDraft } from './draft';
import { ResumeFileError } from './extract';

/** Beyond this, a resume is probably the wrong file, and would cost a lot to parse. */
const MAX_TEXT_CHARS = 60_000;
const KEEP_PENDING = 10;

export interface ImporterDeps {
  paths: DataPaths;
  extract: (bytes: Uint8Array) => Promise<string>;
  parse: (text: string) => Promise<ParsedResume>;
}

function safeName(name: string): string {
  const cleaned = basename(name)
    .replace(/[^\w.-]+/g, '_')
    .slice(-80);
  return cleaned === '' ? 'resume' : cleaned;
}

export function createImporter({ paths, extract, parse }: ImporterDeps) {
  /** Imports waiting to be saved. Held in memory: an unsaved draft is not worth keeping across restarts. */
  const pending = new Map<string, SourceFile>();

  return {
    /**
     * Keeps an untouched copy of the file, reads it, has the parser draft a profile, and checks
     * the draft against the text. Nothing is saved as a profile until the user reviews it.
     */
    async run(file: { name: string; bytes: Uint8Array }): Promise<ImportDraft> {
      const sha256 = createHash('sha256').update(file.bytes).digest('hex');
      const text = await extract(file.bytes);
      if (text.length > MAX_TEXT_CHARS) {
        throw new ResumeFileError(
          'That file has far more text than a resume. Check that it is the right one.',
        );
      }
      const draft = buildDraft(await parse(text), text);

      // Only after a successful read: failed or wrong files aren't kept.
      const rel = join('files', 'imports', `${sha256.slice(0, 8)}-${safeName(file.name)}`);
      mkdirSync(join(paths.root, 'files', 'imports'), { recursive: true });
      writeFileSync(join(paths.root, rel), file.bytes);

      const importId = ulid();
      pending.set(importId, { name: file.name, path: rel, sha256 });
      for (const oldest of [...pending.keys()].slice(0, Math.max(0, pending.size - KEEP_PENDING))) {
        pending.delete(oldest);
      }
      return { importId, fileName: file.name, ...draft };
    },

    sourceFor(importId: string): SourceFile | undefined {
      return pending.get(importId);
    },
  };
}

export type Importer = ReturnType<typeof createImporter>;
