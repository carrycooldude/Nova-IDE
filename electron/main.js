import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol } from 'electron';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

let mainWindow = null;
let workspaceRoot = null;
const localModelRegistry = new Map();

const TEXT_EXTENSIONS = new Set([
  '.css', '.html', '.htm', '.js', '.jsx', '.json', '.md', '.mjs', '.py',
  '.ts', '.tsx', '.txt', '.xml', '.yaml', '.yml',
]);

const KNOWN_MODEL_FILENAMES = new Set([
  'gemma-4-E2B-it-web.litertlm',
  'gemma-4-E4B-it-web.litertlm',
]);

function normalizeRelativePath(input = '/') {
  const normalized = String(input).replace(/\\/g, '/').replace(/^\/+/, '');
  return normalized ? `/${normalized}` : '/';
}

function assertWorkspaceRoot() {
  if (!workspaceRoot) {
    throw new Error('No workspace is open');
  }
}

function resolveWorkspacePath(relativePath = '/') {
  assertWorkspaceRoot();
  const withoutLeadingSlash = normalizeRelativePath(relativePath).slice(1);
  const resolved = path.resolve(workspaceRoot, withoutLeadingSlash);
  const rootWithSep = workspaceRoot.endsWith(path.sep) ? workspaceRoot : `${workspaceRoot}${path.sep}`;

  if (resolved !== workspaceRoot && !resolved.startsWith(rootWithSep)) {
    throw new Error('Path is outside the open workspace');
  }

  return resolved;
}

function toWorkspacePath(absolutePath) {
  const rel = path.relative(workspaceRoot, absolutePath).replace(/\\/g, '/');
  return normalizeRelativePath(rel);
}

function detectLanguage(filename) {
  const ext = path.extname(filename).slice(1).toLowerCase();
  const map = {
    css: 'css',
    html: 'html',
    htm: 'html',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    mjs: 'javascript',
    py: 'python',
    ts: 'typescript',
    tsx: 'typescript',
    txt: 'text',
  };
  return map[ext] || 'text';
}

function modelTokenForPath(filePath) {
  return Buffer.from(filePath, 'utf8').toString('base64url');
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function getDesktopModelSearchDirs() {
  const dirs = [
    path.join(app.getPath('userData'), 'models'),
    path.join(app.getPath('downloads')),
    path.join(app.getPath('desktop')),
    path.join(path.dirname(app.getPath('exe')), 'models'),
    path.join(__dirname, '..', 'models'),
  ];

  const unique = [...new Set(dirs.map(dir => path.resolve(dir)))];
  const existing = [];
  for (const dir of unique) {
    if (await pathExists(dir)) existing.push(dir);
  }
  return existing;
}

async function findLocalModel(filename) {
  if (!KNOWN_MODEL_FILENAMES.has(filename)) return null;

  for (const dir of await getDesktopModelSearchDirs()) {
    const candidate = path.join(dir, filename);
    if (!(await pathExists(candidate))) continue;

    const stat = await fs.stat(candidate);
    if (!stat.isFile()) continue;

    const token = modelTokenForPath(candidate);
    localModelRegistry.set(token, candidate);
    return {
      name: filename,
      path: candidate,
      size: stat.size,
      updatedAt: stat.mtimeMs,
      url: `nova-model://local/${token}/${encodeURIComponent(filename)}`,
    };
  }

  return null;
}

function isTextFile(filePath, size) {
  if (size > 1024 * 1024) return false;
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

async function readWorkspaceFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;

    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await readWorkspaceFiles(absolutePath));
      continue;
    }

    if (!entry.isFile()) continue;

    const stat = await fs.stat(absolutePath);
    if (!isTextFile(absolutePath, stat.size)) continue;

    const content = await fs.readFile(absolutePath, 'utf8');
    files.push({
      path: toWorkspacePath(absolutePath),
      name: entry.name,
      language: detectLanguage(entry.name),
      content,
      updatedAt: stat.mtimeMs,
    });
  }

  return files;
}

async function getWorkspaceSnapshot(selectedPath = null) {
  assertWorkspaceRoot();
  return {
    root: workspaceRoot,
    name: path.basename(workspaceRoot),
    files: await readWorkspaceFiles(workspaceRoot),
    selectedPath,
  };
}

async function openWorkspaceDialog() {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Open Workspace Folder',
  });

  if (result.canceled || !result.filePaths[0]) return null;

  workspaceRoot = path.resolve(result.filePaths[0]);
  return getWorkspaceSnapshot();
}

async function openFileDialog() {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: 'Open File',
  });

  if (result.canceled || !result.filePaths[0]) return null;

  const filePath = path.resolve(result.filePaths[0]);
  workspaceRoot = path.dirname(filePath);
  return getWorkspaceSnapshot(toWorkspacePath(filePath));
}

function sendMenuCommand(command) {
  mainWindow?.webContents.send('nova:menu-command', command);
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Open Folder...', accelerator: 'CmdOrCtrl+O', click: () => sendMenuCommand('open-folder') },
        { label: 'Open File...', accelerator: 'CmdOrCtrl+Shift+O', click: () => sendMenuCommand('open-file') },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => sendMenuCommand('save') },
        { label: 'Save As...', accelerator: 'CmdOrCtrl+Shift+S', click: () => sendMenuCommand('save-as') },
        { type: 'separator' },
        { label: 'Close Workspace', click: () => sendMenuCommand('close-workspace') },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Explorer', accelerator: 'CmdOrCtrl+B', click: () => sendMenuCommand('toggle-explorer') },
        { label: 'Toggle AI Panel', accelerator: 'CmdOrCtrl+Shift+A', click: () => sendMenuCommand('toggle-ai') },
        { label: 'Toggle Terminal', accelerator: 'CmdOrCtrl+`', click: () => sendMenuCommand('toggle-terminal') },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'GPU Diagnostics', click: () => sendMenuCommand('gpu-diagnostics') },
        {
          label: 'About Nova IDE',
          click: () => dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'About Nova IDE',
            message: 'Nova IDE',
            detail: 'Desktop LiteRT LM code editor powered by Electron, JavaScript, and WebGPU.',
          }),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Cross-Origin-Embedder-Policy': ['require-corp'],
        'Cross-Origin-Opener-Policy': ['same-origin'],
      },
    });
  });

  if (isDev) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173');
  } else {
    await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.commandLine.appendSwitch('enable-unsafe-webgpu');
app.commandLine.appendSwitch('enable-features', 'Vulkan,WebGPU');
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'nova-model',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
]);

app.whenReady().then(async () => {
  protocol.handle('nova-model', async (request) => {
    const url = new URL(request.url);
    const token = url.pathname.split('/').filter(Boolean)[0];
    const filePath = localModelRegistry.get(token);
    if (!filePath) {
      return new Response('Model not registered', { status: 404 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });

  buildMenu();
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('nova:select-workspace', openWorkspaceDialog);
ipcMain.handle('nova:select-file', openFileDialog);
ipcMain.handle('nova:get-workspace-root', () => workspaceRoot);
ipcMain.handle('nova:close-workspace', () => {
  workspaceRoot = null;
  return null;
});
ipcMain.handle('nova:read-directory', async () => getWorkspaceSnapshot());
ipcMain.handle('nova:read-file', async (_event, relativePath) => {
  const absolutePath = resolveWorkspacePath(relativePath);
  return fs.readFile(absolutePath, 'utf8');
});
ipcMain.handle('nova:write-file', async (_event, relativePath, content) => {
  const absolutePath = resolveWorkspacePath(relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, 'utf8');
  return getWorkspaceSnapshot(normalizeRelativePath(relativePath));
});
ipcMain.handle('nova:create-file', async (_event, relativePath, content = '') => {
  const absolutePath = resolveWorkspacePath(relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, { encoding: 'utf8', flag: 'wx' });
  return getWorkspaceSnapshot(normalizeRelativePath(relativePath));
});
ipcMain.handle('nova:delete-path', async (_event, relativePath) => {
  const absolutePath = resolveWorkspacePath(relativePath);
  await fs.rm(absolutePath, { recursive: true, force: true });
  return getWorkspaceSnapshot();
});
ipcMain.handle('nova:rename-path', async (_event, oldPath, newPath) => {
  const oldAbsolutePath = resolveWorkspacePath(oldPath);
  const newAbsolutePath = resolveWorkspacePath(newPath);
  await fs.mkdir(path.dirname(newAbsolutePath), { recursive: true });
  await fs.rename(oldAbsolutePath, newAbsolutePath);
  return getWorkspaceSnapshot(normalizeRelativePath(newPath));
});
ipcMain.handle('nova:save-file-as', async (_event, content, suggestedName = 'untitled.txt') => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save File As',
    defaultPath: workspaceRoot ? path.join(workspaceRoot, suggestedName) : suggestedName,
  });

  if (result.canceled || !result.filePath) return null;

  const absolutePath = path.resolve(result.filePath);
  workspaceRoot = workspaceRoot || path.dirname(absolutePath);
  await fs.writeFile(absolutePath, content, 'utf8');
  return getWorkspaceSnapshot(toWorkspacePath(absolutePath));
});
ipcMain.handle('nova:find-local-model', async (_event, filename) => findLocalModel(filename));
ipcMain.handle('nova:get-model-search-dirs', async () => getDesktopModelSearchDirs());
