/// <reference lib="dom" />
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { adaParse } from '../unit/helpers/ada';

const fixtures = join(import.meta.dirname, '../fixtures/resumes');

let dataDir: string;
let app: ElectronApplication;
let server: Server;
let baseUrl: string;
let answer: () => unknown;
let requests: number;

test.beforeEach(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'jobowl-e2e-'));
  answer = adaParse;
  requests = 0;
  // A stand-in for any OpenAI-compatible server (LM Studio, llama.cpp, ...).
  server = createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url?.endsWith('/models')) {
      res.end(JSON.stringify({ object: 'list', data: [{ id: 'fake-model', object: 'model' }] }));
      return;
    }
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString()) as {
        messages: { content: string }[];
      };
      // The Settings "test this model" button sends a one-line ping; everything else is a resume.
      const ping = body.messages[0]?.content === 'Answer with JSON only.';
      if (!ping) requests += 1;
      res.end(
        JSON.stringify({
          id: 'x',
          object: 'chat.completion',
          created: 0,
          model: 'fake-model',
          choices: [
            {
              index: 0,
              finish_reason: 'stop',
              message: {
                role: 'assistant',
                content: JSON.stringify(ping ? { ok: true } : answer()),
              },
            },
          ],
          usage: { prompt_tokens: 900, completion_tokens: 600 },
        }),
      );
    });
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  baseUrl = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}/v1`;
});

test.afterEach(async () => {
  await app.close();
  await new Promise((done) => server.close(done));
  rmSync(dataDir, { recursive: true, force: true });
});

function launch(): Promise<ElectronApplication> {
  return electron.launch({
    args: ['.', '--no-sandbox'],
    env: { ...process.env, JOBOWL_DATA_DIR: dataDir, NO_PROXY: '127.0.0.1', no_proxy: '127.0.0.1' },
  });
}

const nav = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name }).click();

/** Points the parser at the fake server through the real Settings screen. */
async function configureParser(page: Page) {
  await nav(page, 'Settings');
  await page.getByLabel('OpenAI-compatible server address').fill(baseUrl);
  await page.getByLabel('Ollama address').click(); // leaving the field saves it
  // The provider only becomes selectable once the address is saved and the list refreshes.
  await expect(page.locator('#parser-provider option[value="openai_compatible"]')).toBeEnabled();
  await page.getByLabel('Provider').selectOption('openai_compatible');
  await page.getByLabel('Model', { exact: true }).fill('fake-model');
  await page.getByLabel('Ollama address').click(); // leaving the model field saves the choice
}

async function stubFileDialog(file: string) {
  await app.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [path] });
  }, file);
}

test('tests a model, then imports a PDF through the reader process and saves version 1', async () => {
  app = await launch();
  const page = await app.firstWindow();
  await configureParser(page);

  await page.getByRole('button', { name: 'Load model list' }).click();
  await expect(page.getByText('1 models found')).toBeVisible();
  await page.getByRole('button', { name: 'Test this model' }).click();
  await expect(page.getByText(/Works · /)).toBeVisible();

  await nav(page, 'Profile');
  await expect(page.getByRole('heading', { name: 'Start with your resume' })).toBeVisible();
  await stubFileDialog(join(fixtures, 'ada-lovelace.pdf'));
  await page.getByRole('button', { name: 'Import a resume' }).first().click();

  await expect(
    page.getByRole('heading', { name: 'Check what was read from ada-lovelace.pdf' }),
  ).toBeVisible();
  await expect(page.getByLabel('Full name')).toHaveValue('Ada Lovelace');
  await expect(page.getByLabel('Email')).toHaveValue('ada@example.com');
  await expect(page.getByText('Check this against your resume')).toHaveCount(0);
  await expect(page.getByLabel('Bullet 1').first()).toHaveValue(
    'Cut run time of the Bernoulli number program by 40% across 12 machines',
  );

  await page.getByLabel('What changed (optional)').fill('First import');
  await page.getByRole('button', { name: 'Save as v1' }).click();
  await expect(page.getByText(/^v1 · saved/)).toBeVisible();
  await page.getByText('History (1)').click();
  await expect(page.getByText(/v1 · .* · First import · from ada-lovelace\.pdf/)).toBeVisible();
});

test('flags a bullet the model made up', async () => {
  answer = () => {
    const parsed = adaParse();
    parsed.experiences[0]?.bullets.push('Led a team of 50 engineers and saved $2M annually');
    return parsed;
  };
  app = await launch();
  const page = await app.firstWindow();
  await configureParser(page);
  await nav(page, 'Profile');
  await stubFileDialog(join(fixtures, 'ada-lovelace.docx'));
  await page.getByRole('button', { name: 'Import a resume' }).first().click();

  await expect(page.getByText("1 item doesn't match the resume text word for word")).toBeVisible();
  await expect(page.getByText('Check this against your resume')).toHaveCount(2); // the bullet and its role
});

test('pasted text imports, edits save a new version, and everything survives a restart', async () => {
  app = await launch();
  let page = await app.firstWindow();
  await configureParser(page);
  await nav(page, 'Profile');

  const text = (await import('node:fs')).readFileSync(join(fixtures, 'ada-lovelace.txt'), 'utf8');
  await page.getByRole('button', { name: 'Paste text' }).click();
  await page.getByLabel('Resume text').fill(text);
  await page.getByRole('button', { name: 'Read this text' }).click();
  await page.getByRole('button', { name: 'Save as v1' }).click();
  await expect(page.getByText(/^v1 · saved/)).toBeVisible();

  await page.getByLabel('Headline').fill('Mathematician');
  await page.getByLabel('What changed (optional)').fill('New headline');
  await page.getByRole('button', { name: 'Save as v2' }).click();
  await expect(page.getByText(/^v2 · saved/)).toBeVisible();
  await app.close();

  app = await launch();
  page = await app.firstWindow();
  await nav(page, 'Profile');
  await expect(page.getByLabel('Headline')).toHaveValue('Mathematician');
  await expect(page.getByText(/^v2 · saved/)).toBeVisible();
});

test('an unsaved draft survives leaving the screen, and discarding it asks first', async () => {
  app = await launch();
  const page = await app.firstWindow();
  await configureParser(page);
  await nav(page, 'Profile');
  await stubFileDialog(join(fixtures, 'ada-lovelace.txt'));
  await page.getByRole('button', { name: 'Import a resume' }).first().click();
  await expect(page.getByLabel('Full name')).toHaveValue('Ada Lovelace');

  await nav(page, 'Applications');
  await nav(page, 'Profile');
  await expect(page.getByLabel('Full name')).toHaveValue('Ada Lovelace');

  await page.getByRole('button', { name: 'Discard changes' }).click();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByLabel('Full name')).toHaveValue('Ada Lovelace');

  await page.getByRole('button', { name: 'Discard changes' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Discard changes' }).click();
  await expect(page.getByRole('heading', { name: 'Start with your resume' })).toBeVisible();
});

test('says what to do about a scan, and about a missing model, without spending anything', async () => {
  app = await launch();
  const page = await app.firstWindow();
  await nav(page, 'Profile');

  await stubFileDialog(join(fixtures, 'ada-lovelace.txt'));
  await page.getByRole('button', { name: 'Import a resume' }).first().click();
  await expect(page.getByRole('alert')).toContainText('Choose a model for the Parser in Settings');

  await configureParser(page);
  await nav(page, 'Profile');
  await stubFileDialog(join(fixtures, 'scanned-no-text.pdf'));
  await page.getByRole('button', { name: 'Import a resume' }).first().click();
  await expect(page.getByRole('alert')).toContainText('no text in it');
  expect(requests).toBe(0);
});

test('keys are saved as a hint only, or refused when Windows cannot encrypt them', async () => {
  app = await launch();
  const page = await app.firstWindow();
  await nav(page, 'Settings');

  const field = page.getByLabel('Anthropic API key');
  if (await field.isDisabled()) {
    await expect(page.getByRole('alert').first()).toContainText("can't encrypt secrets");
    return;
  }
  await field.fill('sk-ant-test-key-1234');
  await page.getByRole('button', { name: 'Save key' }).first().click();
  await expect(field).toHaveAttribute('placeholder', 'Saved, ends in 1234');
  await expect(field).toHaveValue('');
});
