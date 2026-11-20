/// <reference lib="dom" />
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from '@playwright/test';

const legacyFixture = join(import.meta.dirname, '../fixtures/legacy/applications.json');

let dataDir: string;
let configDir: string;
let app: ElectronApplication;

test.beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'jobowl-e2e-'));
  configDir = mkdtempSync(join(tmpdir(), 'jobowl-config-'));
});

test.afterEach(async () => {
  await app.close();
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(configDir, { recursive: true, force: true });
});

/** `configDir` stands in for %APPDATA% (Windows) or ~/.config (Linux), where jobowl 0.1 kept its file. */
function launch(): Promise<ElectronApplication> {
  return electron.launch({
    args: ['.', '--no-sandbox'],
    env: {
      ...process.env,
      JOBOWL_DATA_DIR: dataDir,
      APPDATA: configDir,
      XDG_CONFIG_HOME: configDir,
    },
  });
}

async function addApplication(page: Page, company: string, position: string, notes = '') {
  await page.getByRole('link', { name: 'Add application' }).first().click();
  await expect(page.getByRole('heading', { name: 'New application' })).toBeVisible();
  await page.getByLabel('Company').fill(company);
  await page.getByLabel('Position').fill(position);
  if (notes) await page.getByLabel('Notes').fill(notes);
  await page.getByRole('button', { name: 'Add application' }).click();
  await expect(page.getByRole('heading', { name: company, level: 2 })).toBeVisible();
}

test('opens on an honest empty tracker and creates the database', async () => {
  app = await launch();
  const page = await app.firstWindow();

  await expect(page).toHaveTitle('jobowl');
  await expect(page.getByRole('heading', { name: 'Applications', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Nothing tracked yet' })).toBeVisible();
  expect(existsSync(join(dataDir, 'jobowl.db'))).toBe(true);
  expect(existsSync(join(dataDir, 'backups'))).toBe(true);
});

test('adds an application, moves it through statuses and keeps a history', async () => {
  app = await launch();
  const page = await app.firstWindow();

  await addApplication(page, 'Acme Robotics', 'Embedded Engineer', 'Referred by Dana');
  await expect(page.getByLabel('Notes')).toHaveValue('Referred by Dana');
  await expect(page.getByText('Added manually')).toBeVisible();

  await page.getByRole('radio', { name: 'Interview' }).last().click();
  await expect(page.getByText('Status changed from Applied to Interview')).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Saved');
});

test('sorts by status priority and filters by status and search', async () => {
  app = await launch();
  const page = await app.firstWindow();

  await addApplication(page, 'Alpha', 'Dev');
  await addApplication(page, 'Beta', 'Designer');
  await addApplication(page, 'Gamma', 'Dev');
  await page.getByRole('link', { name: /Gamma/ }).click();
  await page.getByRole('radio', { name: 'Interview' }).last().click();
  await expect(page.getByText('Status changed from Applied to Interview')).toBeVisible();

  const rows = page.getByRole('list', { name: 'Applications' }).getByRole('link');
  await expect(rows.first()).toContainText('Gamma');

  await page
    .getByRole('radiogroup', { name: 'Filter by status' })
    .getByRole('radio', { name: 'Interview' })
    .click();
  await expect(rows).toHaveCount(1);

  await page
    .getByRole('radiogroup', { name: 'Filter by status' })
    .getByRole('radio', { name: 'All' })
    .click();
  await page.getByLabel('Search applications').fill('designer');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Beta');

  await page.getByLabel('Search applications').fill('nothing like this');
  await expect(page.getByRole('heading', { name: 'Nothing matches these filters' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(rows).toHaveCount(3);
});

test('edits save on blur and survive a restart', async () => {
  app = await launch();
  let page = await app.firstWindow();
  await addApplication(page, 'Acme', 'Engineer');

  await page.getByLabel('Notes').fill('Phone screen on Friday');
  await page.getByLabel('Company').click(); // moves focus away, which saves
  await expect(page.getByText('Notes updated')).toBeVisible();
  await app.close();

  app = await launch();
  page = await app.firstWindow();
  await page.getByRole('link', { name: /Acme/ }).click();
  await expect(page.getByLabel('Notes')).toHaveValue('Phone screen on Friday');
});

test('refuses an empty company and keeps what was typed', async () => {
  app = await launch();
  const page = await app.firstWindow();
  await addApplication(page, 'Acme', 'Engineer');

  await page.getByLabel('Company').fill('   ');
  await page.getByLabel('Position').click();
  await expect(page.getByRole('alert')).toContainText('Required');
  await expect(page.getByRole('heading', { name: 'Acme', level: 2 })).toBeVisible();
});

test('asks before deleting and removes the application and its history', async () => {
  app = await launch();
  const page = await app.firstWindow();
  await addApplication(page, 'Acme', 'Engineer');

  await page.getByRole('button', { name: 'Delete application' }).click();
  await page.getByRole('button', { name: 'Keep it' }).click();
  await expect(page.getByRole('heading', { name: 'Acme', level: 2 })).toBeVisible();

  await page.getByRole('button', { name: 'Delete application' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete application' }).click();
  await expect(page.getByRole('heading', { name: 'Nothing tracked yet' })).toBeVisible();
});

test('works from the keyboard: n adds, / searches, arrows move through the list', async () => {
  app = await launch();
  const page = await app.firstWindow();
  await addApplication(page, 'Alpha', 'Dev');
  await addApplication(page, 'Beta', 'Dev');

  await page.keyboard.press('n');
  await expect(page.getByRole('heading', { name: 'New application' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.keyboard.press('/');
  await expect(page.getByLabel('Search applications')).toBeFocused();
  await page.keyboard.press('Escape');

  const first = page.getByRole('list', { name: 'Applications' }).getByRole('link').first();
  await first.focus();
  await page.keyboard.press('ArrowDown');
  await expect(
    page.getByRole('list', { name: 'Applications' }).getByRole('link').nth(1),
  ).toHaveAttribute('aria-current', 'page');
});

test('imports jobowl 0.1 data once, skipping its sample entries', async () => {
  const legacyDir = join(configDir, 'job-tracker');
  mkdirSync(legacyDir, { recursive: true });
  cpSync(legacyFixture, join(legacyDir, 'applications.json'));

  app = await launch();
  const page = await app.firstWindow();
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Settings' })
    .click();

  await expect(page.getByText('Found 5 applications from jobowl 0.1')).toBeVisible();
  await page.getByRole('button', { name: 'Import 2 applications' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Imported 2 applications' }),
  ).toContainText('Skipped 3 sample entries');
  await expect(page.getByRole('button', { name: /^Import/ })).toHaveCount(0);

  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Applications' })
    .click();
  const rows = page.getByRole('list', { name: 'Applications' }).getByRole('link');
  await expect(rows).toHaveCount(2);
  await rows.filter({ hasText: 'Acme Robotics' }).click();
  await expect(page.getByLabel('Notes')).toHaveValue('Referred by Dana. Phone screen went well.');
  await expect(page.getByText('Status changed from Applied to Interview')).toBeVisible();
});

test('theme defaults to dark and the choice survives a restart', async () => {
  app = await launch();
  let page = await app.firstWindow();
  await expect(page.locator('html')).toHaveClass(/dark/);

  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Settings' })
    .click();
  await page.getByRole('radio', { name: 'Light' }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await app.close();

  app = await launch();
  page = await app.firstWindow();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});

test('the renderer has no Node access and can only reach the typed api', async () => {
  app = await launch();
  const page = await app.firstWindow();
  const probe = await page.evaluate(() => ({
    require: typeof (window as unknown as { require?: unknown }).require,
    process: typeof (window as unknown as { process?: unknown }).process,
    api: Object.keys((window as unknown as { jobowl: object }).jobowl),
  }));
  expect(probe).toEqual({ require: 'undefined', process: 'undefined', api: ['invoke'] });

  const rejected = await page.evaluate(async () => {
    try {
      await (
        window as unknown as { jobowl: { invoke(c: string): Promise<unknown> } }
      ).jobowl.invoke('fs:read');
      return 'allowed';
    } catch (error) {
      return String(error);
    }
  });
  expect(rejected).toContain('Unknown channel');
});
