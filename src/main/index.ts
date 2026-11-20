import { basename, join } from 'node:path';
import { readFile } from 'node:fs/promises';
import {
  app,
  BrowserWindow,
  dialog,
  Notification,
  safeStorage,
  shell,
  type IpcMainInvokeEvent,
} from 'electron';
import { openDb } from './db/open';
import { registerIpc } from './ipc/register';
import { extractInWorker } from './resume/extract-client';
import { startScheduler } from './runs/scheduler';
import { createHttp } from './sources/http';
import { dataPaths } from './paths';

app.setName('jobowl');

const dataRoot = process.env['JOBOWL_DATA_DIR'] ?? join(app.getPath('appData'), 'jobowl');
const migrationsDir = app.isPackaged
  ? join(process.resourcesPath, 'drizzle')
  : join(app.getAppPath(), 'drizzle');

let mainWindow: BrowserWindow | null = null;

/** Tests point job-board hosts at a local server. Only loopback targets are accepted. */
function originRewrite(): ((url: string) => string) | undefined {
  const raw = process.env['JOBOWL_ORIGIN_OVERRIDES'];
  if (!raw) return undefined;
  const map = Object.entries(JSON.parse(raw) as Record<string, string>).filter(([, to]) => {
    const host = new URL(to).hostname;
    return host === '127.0.0.1' || host === 'localhost';
  });
  return (url) => {
    const hit = map.find(([from]) => url.startsWith(from));
    return hit ? hit[1] + url.slice(hit[0].length) : url;
  };
}

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

  const rewrite = originRewrite();
  const { orchestrator } = registerIpc({
    http: createHttp({
      userAgent: `jobowl/${app.getVersion()} (+https://github.com/rekasa7000/jobowl)`,
      ...(rewrite ? { rewrite, hostGapMs: 0 } : {}),
    }),
    notify: (matches) => {
      const top = [...matches].sort((a, b) => b.score - a.score)[0];
      if (!top || !Notification.isSupported()) return;
      const toast = new Notification({
        title:
          matches.length === 1
            ? 'New strong match'
            : `${String(matches.length)} new strong matches`,
        body: `${top.title} at ${top.company} (${String(top.score)})`,
      });
      toast.on('click', () => mainWindow?.show());
      toast.show();
    },
    setLoginItem: (openAtLogin) => app.setLoginItemSettings({ openAtLogin }),
    db,
    version: app.getVersion(),
    platform: process.platform,
    dataDir: dataRoot,
    // jobowl 0.1 wrote to the config folder, which is %APPDATA% on Windows.
    legacyFile: join(app.getPath('appData'), 'job-tracker', 'applications.json'),
    extractResume: extractInWorker,
    pickResumeFile: async () => {
      if (!mainWindow) return null;
      const choice = await dialog.showOpenDialog(mainWindow, {
        title: 'Choose your resume',
        properties: ['openFile'],
        filters: [{ name: 'Resumes (PDF, DOCX, text)', extensions: ['pdf', 'docx', 'txt'] }],
      });
      const path = choice.filePaths[0];
      if (choice.canceled || !path) return null;
      return { name: basename(path), bytes: new Uint8Array(await readFile(path)) };
    },
    // Windows encrypts keys for this user account (DPAPI). Without it, keys aren't stored at all.
    cipher: {
      isAvailable: () => safeStorage.isAsyncEncryptionAvailable(),
      encrypt: (plain) => safeStorage.encryptStringAsync(plain),
      decrypt: async (encrypted) => {
        const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(encrypted);
        return { text: result, reEncrypt: shouldReEncrypt };
      },
    },
    isTrusted,
  });

  mainWindow = createWindow();
  app.on('will-quit', startScheduler(orchestrator));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  app.on('window-all-closed', () => app.quit());
}

void main();
