/**
 * file-system.js - Browser/Electron workspace file system facade.
 */

const DB_NAME = 'nova-ide-fs';
const DB_VERSION = 1;
const STORE_NAME = 'files';

function detectLanguage(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    py: 'python', html: 'html', htm: 'html', css: 'css',
    json: 'json', md: 'markdown', txt: 'text',
  };
  return map[ext] || 'text';
}

function normalizePath(path) {
  const normalized = String(path || '/').replace(/\\/g, '/').replace(/^\/+/, '');
  return normalized ? `/${normalized}` : '/';
}

function fileNameFromPath(path) {
  return normalizePath(path).split('/').pop() || 'untitled.txt';
}

function buildTree(files, rootName = 'project') {
  const tree = { name: rootName, children: [], type: 'folder', path: '/' };
  const sorted = [...files.keys()].sort();

  for (const filePath of sorted) {
    const parts = filePath.split('/').filter(Boolean);
    let current = tree;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;

      if (isFile) {
        const file = files.get(filePath);
        current.children.push({
          name: part,
          type: 'file',
          path: filePath,
          language: file.language,
        });
      } else {
        let folder = current.children.find(c => c.name === part && c.type === 'folder');
        if (!folder) {
          folder = { name: part, type: 'folder', children: [], path: '/' + parts.slice(0, i + 1).join('/') };
          current.children.push(folder);
        }
        current = folder;
      }
    }
  }

  return tree;
}

class WebFileSystemProvider {
  constructor() {
    this.db = null;
    this.files = new Map();
    this.workspaceName = 'Demo Project';
    this.workspaceRoot = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'path' });
        }
      };
      req.onsuccess = async () => {
        this.db = req.result;
        await this._loadAll();
        if (this.files.size === 0) await this._seedDefaults();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  async _loadAll() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => {
        this.files.clear();
        req.result.forEach(f => this.files.set(f.path, f));
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  async _seedDefaults() {
    const defaults = [
      {
        path: '/src/main.py',
        language: 'python',
        content: `# Welcome to Nova IDE
# Powered by on-device Local AI

def fibonacci(n: int) -> list[int]:
    """Generate Fibonacci sequence up to n terms."""
    if n <= 0:
        return []

    sequence = [0, 1]
    while len(sequence) < n:
        sequence.append(sequence[-1] + sequence[-2])

    return sequence[:n]


def main():
    result = fibonacci(10)
    print(f"Fibonacci(10): {result}")


if __name__ == "__main__":
    main()
`,
      },
      {
        path: '/src/app.js',
        language: 'javascript',
        content: `// Nova IDE JavaScript Example
// Use the AI panel (Ctrl+Shift+A) for code assistance

class TaskManager {
  constructor() {
    this.tasks = [];
    this.nextId = 1;
  }

  addTask(title, priority = 'medium') {
    const task = {
      id: this.nextId++,
      title,
      priority,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    this.tasks.push(task);
    return task;
  }

  completeTask(id) {
    const task = this.tasks.find(t => t.id === id);
    if (task) task.completed = true;
    return task;
  }

  getPending() {
    return this.tasks.filter(t => !t.completed);
  }
}

const manager = new TaskManager();
manager.addTask('Integrate Local AI model', 'high');
console.log('Pending tasks:', manager.getPending());
`,
      },
      {
        path: '/index.html',
        language: 'html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My App</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app">
    <h1>Hello from Nova IDE!</h1>
    <p>Edit this file and ask the AI for help.</p>
  </div>
  <script src="src/app.js"></script>
</body>
</html>
`,
      },
      {
        path: '/styles.css',
        language: 'css',
        content: `:root {
  --primary: #7c3aed;
  --bg: #0d1117;
  --text: #e6edf3;
}

body {
  font-family: Inter, sans-serif;
  background: var(--bg);
  color: var(--text);
}
`,
      },
      {
        path: '/README.md',
        language: 'markdown',
        content: `# My Project

Built with Nova IDE.

1. Open a file from the explorer
2. Use Ctrl+Shift+A to toggle the AI assistant
3. Ask AI to help you code
`,
      },
    ];

    for (const file of defaults) {
      await this.writeFile(file.path, file.content, file.language);
    }
  }

  async writeFile(path, content, language) {
    const normalized = normalizePath(path);
    const name = fileNameFromPath(normalized);
    const entry = {
      path: normalized,
      name,
      language: language || detectLanguage(name),
      content,
      updatedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(entry);
      tx.oncomplete = () => {
        this.files.set(normalized, entry);
        resolve(entry);
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async createFile(path, content = '') {
    return this.writeFile(path, content);
  }

  async deletePath(path) {
    const normalized = normalizePath(path);
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(normalized);
      tx.oncomplete = () => {
        this.files.delete(normalized);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async renamePath(oldPath, newPath) {
    const oldFile = this.files.get(normalizePath(oldPath));
    if (!oldFile) throw new Error('File not found');
    await this.writeFile(newPath, oldFile.content);
    await this.deletePath(oldPath);
  }

  getTree() {
    return buildTree(this.files, this.workspaceName);
  }
}

class ElectronFileSystemProvider {
  constructor(api) {
    this.api = api;
    this.files = new Map();
    this.workspaceName = 'Desktop Workspace';
    this.workspaceRoot = null;
  }

  async init() {
    const root = await this.api.getWorkspaceRoot();
    if (root) {
      await this.refresh();
    }
  }

  _applySnapshot(snapshot) {
    if (!snapshot) return null;
    this.workspaceRoot = snapshot.root;
    this.workspaceName = snapshot.name || 'Desktop Workspace';
    this.files.clear();
    snapshot.files.forEach(file => {
      const normalized = normalizePath(file.path);
      const name = file.name || fileNameFromPath(normalized);
      this.files.set(normalized, {
        ...file,
        path: normalized,
        name,
        language: file.language || detectLanguage(name),
      });
    });
    return snapshot.selectedPath ? normalizePath(snapshot.selectedPath) : null;
  }

  async refresh() {
    return this._applySnapshot(await this.api.readDirectory());
  }

  async selectWorkspace() {
    return this._applySnapshot(await this.api.selectWorkspace());
  }

  async selectFile() {
    return this._applySnapshot(await this.api.selectFile());
  }

  async writeFile(path, content, language) {
    const normalized = normalizePath(path);
    const snapshot = await this.api.writeFile(normalized, content);
    this._applySnapshot(snapshot);
    return this.files.get(normalized) || {
      path: normalized,
      name: fileNameFromPath(normalized),
      language: language || detectLanguage(normalized),
      content,
    };
  }

  async createFile(path, content = '') {
    const selectedPath = this._applySnapshot(await this.api.createFile(normalizePath(path), content));
    return selectedPath;
  }

  async deletePath(path) {
    this._applySnapshot(await this.api.deletePath(normalizePath(path)));
  }

  async renamePath(oldPath, newPath) {
    const selectedPath = this._applySnapshot(await this.api.renamePath(normalizePath(oldPath), normalizePath(newPath)));
    return selectedPath;
  }

  async saveFileAs(content, suggestedName) {
    return this._applySnapshot(await this.api.saveFileAs(content, suggestedName));
  }

  async closeWorkspace() {
    await this.api.closeWorkspace();
    this.workspaceRoot = null;
    this.workspaceName = 'Desktop Workspace';
    this.files.clear();
  }

  getTree() {
    return buildTree(this.files, this.workspaceName);
  }
}

class WorkspaceFileSystem {
  constructor() {
    this.listeners = new Set();
    this.isDesktop = Boolean(window.novaDesktop?.isElectron);
    this.provider = this.isDesktop
      ? new ElectronFileSystemProvider(window.novaDesktop)
      : new WebFileSystemProvider();
    this.files = this.provider.files;
  }

  get workspaceRoot() {
    return this.provider.workspaceRoot;
  }

  get workspaceName() {
    return this.provider.workspaceName;
  }

  get hasWorkspace() {
    return !this.isDesktop || Boolean(this.workspaceRoot);
  }

  async init() {
    await this.provider.init();
    this.files = this.provider.files;
  }

  readFile(path) {
    return this.files.get(normalizePath(path)) || null;
  }

  async writeFile(path, content, language) {
    const result = await this.provider.writeFile(path, content, language);
    this.files = this.provider.files;
    this._emit();
    return result;
  }

  async createFile(path, content = '') {
    const result = await this.provider.createFile(path, content);
    this.files = this.provider.files;
    this._emit();
    return result;
  }

  async deletePath(path) {
    await this.provider.deletePath(path);
    this.files = this.provider.files;
    this._emit();
  }

  async renamePath(oldPath, newPath) {
    const result = await this.provider.renamePath(oldPath, newPath);
    this.files = this.provider.files;
    this._emit();
    return result;
  }

  async openWorkspace() {
    if (!this.provider.selectWorkspace) return null;
    const selectedPath = await this.provider.selectWorkspace();
    this.files = this.provider.files;
    this._emit();
    return selectedPath;
  }

  async openFileFromDialog() {
    if (!this.provider.selectFile) return null;
    const selectedPath = await this.provider.selectFile();
    this.files = this.provider.files;
    this._emit();
    return selectedPath;
  }

  async refresh() {
    if (!this.provider.refresh) return null;
    const selectedPath = await this.provider.refresh();
    this.files = this.provider.files;
    this._emit();
    return selectedPath;
  }

  async saveFileAs(content, suggestedName) {
    if (!this.provider.saveFileAs) return null;
    const selectedPath = await this.provider.saveFileAs(content, suggestedName);
    this.files = this.provider.files;
    this._emit();
    return selectedPath;
  }

  async closeWorkspace() {
    if (!this.provider.closeWorkspace) return null;
    await this.provider.closeWorkspace();
    this.files = this.provider.files;
    this._emit();
    return null;
  }

  getTree() {
    return this.provider.getTree();
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit() {
    this.listeners.forEach(fn => fn());
  }
}

export const vfs = new WorkspaceFileSystem();
