import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PARSER_VERSION, parseResume, parsedResumeSchema } from '../../src/main/ai/layers/parser';
import {
  NotConfiguredError,
  type GenerateRequest,
  type LlmProvider,
} from '../../src/main/ai/provider';
import type { AiServices } from '../../src/main/ai/run-layer';
import { createAiCallsRepo } from '../../src/main/db/ai-calls-repo';
import { openDb, type Db } from '../../src/main/db/open';
import { extractResumeText, ResumeFileError } from '../../src/main/resume/extract';
import { createImporter } from '../../src/main/resume/importer';
import { dataPaths } from '../../src/main/paths';
import { defaultAiSettings } from '@shared/schemas/ai';
import { adaParse } from './helpers/ada';

const migrations = join(import.meta.dirname, '../../drizzle');
const fixtures = join(import.meta.dirname, '../fixtures/resumes');

let root: string;
let db: Db;
let seen: GenerateRequest<unknown>[];

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'jobowl-import-'));
  db = await openDb(dataPaths(root), migrations);
  seen = [];
});

afterEach(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});

function ai(answer: () => unknown = adaParse, configured = true): AiServices {
  const provider: LlmProvider = {
    id: 'ollama',
    listModels: () => Promise.resolve([]),
    generateObject: ((request: GenerateRequest<unknown>) => {
      seen.push(request);
      return Promise.resolve({
        value: request.schema.parse(answer()),
        usage: { inputTokens: 900, outputTokens: 700, cachedInputTokens: 0, cacheWriteTokens: 0 },
      });
    }) as LlmProvider['generateObject'],
  };
  return {
    getSettings: () => ({
      ...defaultAiSettings,
      layers: configured ? { parser: { provider: 'ollama', model: 'llama3.1' } } : {},
    }),
    providerFor: () => Promise.resolve(provider),
    calls: createAiCallsRepo(db),
  };
}

describe('parseResume', () => {
  it('sends the resume inside data tags, with the rules in the system prompt', async () => {
    await parseResume(ai(), 'Ada Lovelace\nEngineer');
    expect(seen[0]?.input).toBe('<resume>\nAda Lovelace\nEngineer\n</resume>');
    expect(seen[0]?.system).toMatch(/copy; you never write/);
    expect(seen[0]?.system).toMatch(/ignore them/);
    expect(seen[0]?.model).toBe('llama3.1');
  });

  it('logs the call under the parser with its prompt version', async () => {
    await parseResume(ai(), 'Ada Lovelace\nEngineer');
    const row = db.sqlite.prepare('select layer, prompt_version as v, outcome from ai_calls').get();
    expect(row).toEqual({ layer: 'parser', v: PARSER_VERSION, outcome: 'ok' });
  });

  it('tells the user to pick a model when none is chosen', async () => {
    await expect(parseResume(ai(adaParse, false), 'text')).rejects.toThrow(NotConfiguredError);
  });

  it('asks for a shape every strict-schema provider accepts: all fields required', () => {
    const schema = JSON.stringify(parsedResumeSchema.toJSONSchema());
    expect(schema).not.toContain('"anyOf"');
    expect(schema).not.toContain('minLength');
  });
});

describe('importer', () => {
  const importer = (answer?: () => unknown) =>
    createImporter({
      paths: dataPaths(root),
      extract: extractResumeText,
      parse: (text) => parseResume(ai(answer), text),
    });

  it.each(['ada-lovelace.txt', 'ada-lovelace.docx', 'ada-lovelace.pdf'])(
    'turns %s into a clean draft with nothing to double-check',
    async (name) => {
      const bytes = new Uint8Array(readFileSync(join(fixtures, name)));
      const draft = await importer().run({ name, bytes });
      expect(draft.profile.person.fullName).toBe('Ada Lovelace');
      expect(draft.profile.experiences).toHaveLength(2);
      expect(draft.lowConfidence).toEqual([]);
      expect(draft.warnings).toEqual([]);
    },
  );

  it('keeps an untouched copy of the original file', async () => {
    const bytes = new Uint8Array(readFileSync(join(fixtures, 'ada-lovelace.docx')));
    await importer().run({ name: 'My Resume (final).docx', bytes });
    const dir = join(root, 'files', 'imports');
    const [kept] = readdirSync(dir);
    expect(kept).toMatch(/^[0-9a-f]{8}-My_Resume_final_\.docx$/);
    expect(new Uint8Array(readFileSync(join(dir, kept ?? '')))).toEqual(bytes);
  });

  it('remembers where an import came from so saving can link it', async () => {
    const imp = importer();
    const bytes = new Uint8Array(readFileSync(join(fixtures, 'ada-lovelace.txt')));
    const draft = await imp.run({ name: 'ada.txt', bytes });
    const source = imp.sourceFor(draft.importId);
    expect(source?.name).toBe('ada.txt');
    expect(source?.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(imp.sourceFor('unknown')).toBeUndefined();
  });

  it('keeps nothing from a file that could not be read', async () => {
    const scanned = new Uint8Array(readFileSync(join(fixtures, 'scanned-no-text.pdf')));
    await expect(importer().run({ name: 'scan.pdf', bytes: scanned })).rejects.toThrow(
      ResumeFileError,
    );
    expect(existsSync(join(root, 'files', 'imports'))).toBe(false);
    expect(seen).toHaveLength(0);
  });

  it('refuses a file with far more text than a resume, before spending anything', async () => {
    const huge = new TextEncoder().encode('word '.repeat(20_000));
    await expect(importer().run({ name: 'book.txt', bytes: huge })).rejects.toThrow(
      /far more text than a resume/,
    );
    expect(seen).toHaveLength(0);
  });

  it('flags what a hallucinating model adds', async () => {
    const answer = () => {
      const parsed = adaParse();
      parsed.skills.push('Kubernetes');
      parsed.experiences[0]?.bullets.push('Led a migration to Kubernetes for 200 services');
      return parsed;
    };
    const bytes = new Uint8Array(readFileSync(join(fixtures, 'ada-lovelace.txt')));
    const draft = await importer(answer).run({ name: 'ada.txt', bytes });
    expect(draft.warnings.join(' ')).toMatch(/match the resume text/);
    expect(draft.lowConfidence.length).toBeGreaterThan(0);
  });
});
