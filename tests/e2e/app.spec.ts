/// <reference lib="dom" />
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';

let dataDir: string;
let app: ElectronApplication;

test.beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'jobowl-e2e-'));
});

test.afterEach(async () => {
  await app.close();
  rmSync(dataDir, { recursive: true, force: true });
});

function launch(): Promise<ElectronApplication> {
  return electron.launch({
    args: ['.', '--no-sandbox'],
    env: { ...process.env, JOBOWL_DATA_DIR: dataDir },
  });
}

test('opens the empty shell and creates the database', async () => {
  app = await launch();
  const page = await app.firstWindow();

  await expect(page).toHaveTitle('jobowl');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No applications yet' })).toBeVisible();
  await expect(page.getByText('v1', { exact: true })).toBeVisible();
  expect(existsSync(join(dataDir, 'jobowl.db'))).toBe(true);
  expect(existsSync(join(dataDir, 'backups'))).toBe(true);
});

test('theme defaults to dark and the choice survives a restart', async () => {
  app = await launch();
  let page = await app.firstWindow();
  await expect(page.locator('html')).toHaveClass(/dark/);

  await page.getByRole('radio', { name: 'Light' }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await app.close();

  app = await launch();
  page = await app.firstWindow();
  await expect(page.getByRole('radio', { name: 'Light' })).toHaveAttribute('aria-checked', 'true');
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
