import { join } from 'node:path';
import { app, BrowserWindow, shell, type IpcMainInvokeEvent } from 'electron';
import { openDb } from './db/open';
import { registerIpc } from './ipc/register';
import { dataPaths } from './paths';

app.setName('jobowl');

const dataRoot = process.env['JOBOWL_DATA_DIR'] ?? join(app.getPath('appData'), 'jobowl');
const migrationsDir = app.isPackaged
  ? join(process.resourcesPath, 'drizzle')
  : join(app.getAppPath(), 'drizzle');

let mainWindow: BrowserWindow | null = null;

function isAllowedExternal(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    title: 'jobowl',
    backgroundColor: '#013230',
    icon: join(app.getAppPath(), 'resources', 'icons', 'jobowl.png'),
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  win.once('ready-to-show', () => win.show());

  // The window only ever shows the app's own pages. Anything else goes to the default browser.
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternal(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (!app.isPackaged && devUrl) void win.loadURL(devUrl);
  else void win.loadFile(join(import.meta.dirname, '../renderer/index.html'));

  return win;
}

async function main(): Promise<void> {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  app.on('second-instance', () => {
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.focus();
  });

  await app.whenReady();

  const db = await openDb(dataPaths(dataRoot), migrationsDir);
  app.on('will-quit', () => db.close());

  const isTrusted = (event: IpcMainInvokeEvent): boolean =>
    mainWindow !== null &&
    event.sender.id === mainWindow.webContents.id &&
    event.senderFrame === event.sender.mainFrame;

  registerIpc({
    db,
    version: app.getVersion(),
    platform: process.platform,
    dataDir: dataRoot,
    // jobowl 0.1 wrote to the config folder, which is %APPDATA% on Windows.
    legacyFile: join(app.getPath('appData'), 'job-tracker', 'applications.json'),
    isTrusted,
  });

  mainWindow = createWindow();
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  app.on('window-all-closed', () => app.quit());
}

void main();
