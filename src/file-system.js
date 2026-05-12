/**
 * file-system.js — Virtual in-browser file system backed by IndexedDB.
 */

const DB_NAME = 'nova-ide-fs';
const DB_VERSION = 1;
const STORE_NAME = 'files';

class VirtualFileSystem {
  constructor() {
    this.db = null;
    this.listeners = new Set();
    // In-memory cache for fast access
    this.files = new Map();
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
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
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
        name: 'main.py',
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
    
    # Ask the AI assistant for help!
    # Try: "Optimize this fibonacci function"


if __name__ == "__main__":
    main()
`,
      },
      {
        path: '/src/app.js',
        name: 'app.js',
        language: 'javascript',
        content: `// Nova IDE — JavaScript Example
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
    return this.tasks
      .filter(t => !t.completed)
      .sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.priority] - order[b.priority];
      });
  }
}

const manager = new TaskManager();
manager.addTask('Integrate Local AI model', 'high');
manager.addTask('Write unit tests', 'medium');
manager.addTask('Update README', 'low');

console.log('Pending tasks:', manager.getPending());
`,
      },
      {
        path: '/index.html',
        name: 'index.html',
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
        name: 'styles.css',
        language: 'css',
        content: `/* Global Styles */
:root {
  --primary: #7c3aed;
  --bg: #0d1117;
  --text: #e6edf3;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Inter', sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

h1 {
  background: linear-gradient(135deg, var(--primary), #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-size: 2rem;
}
`,
      },
      {
        path: '/README.md',
        name: 'README.md',
        language: 'markdown',
        content: `# My Project

> Built with Nova IDE — on-device AI coding.

## Getting Started

1. Open a file from the explorer
2. Use **Ctrl+Shift+A** to toggle the AI assistant
3. Ask AI to help you code!

## Features

- On-device inference (no cloud needed)
- WebGPU accelerated
- Full privacy — your code never leaves the browser
`,
      },
    ];

    for (const file of defaults) {
      await this.writeFile(file.path, file.content, file.language);
    }
  }

  async writeFile(path, content, language) {
    const name = path.split('/').pop();
    const lang = language || this._detectLanguage(name);
    const entry = { path, name, language: lang, content, updatedAt: Date.now() };

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(entry);
      tx.oncomplete = () => {
        this.files.set(path, entry);
        this._emit();
        resolve(entry);
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  readFile(path) {
    return this.files.get(path) || null;
  }

  async deleteFile(path) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(path);
      tx.oncomplete = () => {
        this.files.delete(path);
        this._emit();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  getTree() {
    const tree = { name: 'project', children: [], type: 'folder', path: '/' };
    const sorted = [...this.files.keys()].sort();

    for (const filePath of sorted) {
      const parts = filePath.split('/').filter(Boolean);
      let current = tree;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;

        if (isFile) {
          current.children.push({
            name: part,
            type: 'file',
            path: filePath,
            language: this.files.get(filePath).language,
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

  _detectLanguage(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const map = {
      js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
      py: 'python', html: 'html', htm: 'html', css: 'css',
      json: 'json', md: 'markdown', txt: 'text',
    };
    return map[ext] || 'text';
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit() {
    this.listeners.forEach(fn => fn());
  }
}

export const vfs = new VirtualFileSystem();
