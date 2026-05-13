/**
 * main.js — Nova IDE application bootstrap.
 * Wires together: file system, editor, chat panel, terminal, agent.
 */
import './style.css';
import { vfs } from './file-system.js';
import { createEditor, destroyEditor } from './editor.js';
import { ChatPanel } from './chat.js';
import { Terminal } from './terminal.js';
import { CommandPalette, InlineActions, editorContext } from './agent.js';

// ---- State ----
let currentFile = null;
let editorView = null;
let sidebarVisible = true;
let aiPanelVisible = true;
let terminalVisible = true;

// ---- Icons ----
const FILE_ICONS = {
  javascript: '📜', typescript: '📘', python: '🐍',
  html: '🌐', css: '🎨', json: '📋', markdown: '📝', text: '📄',
};

const FOLDER_ICON = '📁';
const FOLDER_OPEN_ICON = '📂';

// ---- Build UI Shell ----
function buildShell() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <!-- Title Bar -->
    <div class="titlebar">
      <div class="titlebar__logo">
        <div class="titlebar__logo-icon">⚡</div>
        <span>Nova IDE</span>
      </div>
      <div class="titlebar__menu">
        <span class="titlebar__menu-item" id="menu-file">File</span>
        <span class="titlebar__menu-item" id="menu-view">View</span>
        <span class="titlebar__menu-item" id="menu-help">Help</span>
      </div>
      <div class="titlebar__spacer"></div>
      <div class="titlebar__status">
        <span id="titlebar-model-status">No AI loaded</span>
      </div>
    </div>

    <!-- Main Layout -->
    <div class="main-layout">
      <!-- Activity Bar -->
      <div class="activity-bar">
        <button class="activity-bar__btn active" id="act-explorer" title="Explorer (Ctrl+B)">📁</button>
        <button class="activity-bar__btn" id="act-search" title="Search">🔍</button>
        <div class="activity-bar__spacer"></div>
        <button class="activity-bar__btn activity-bar__btn--ai" id="act-ai" title="AI Assistant (Ctrl+Shift+A)">
          ✦
          <span class="ai-dot"></span>
        </button>
        <button class="activity-bar__btn" id="act-terminal" title="Terminal (Ctrl+\`)">⌨</button>
        <button class="activity-bar__btn" id="act-settings" title="Settings">⚙</button>
      </div>

      <!-- Sidebar -->
      <div class="sidebar" id="sidebar">
        <div class="sidebar__header">Explorer</div>
        <div class="sidebar__content" id="file-tree"></div>
      </div>

      <!-- Editor + Terminal -->
      <div style="flex:1; display:flex; flex-direction:column; min-width:0;">
        <!-- Editor Area -->
        <div class="editor-area" id="editor-area">
          <div class="tab-bar" id="tab-bar"></div>
          <div class="editor-container" id="editor-container">
            <div class="welcome-screen" id="welcome-screen">
              <div class="welcome-screen__logo">⚡</div>
              <div class="welcome-screen__title">Nova IDE</div>
              <div class="welcome-screen__subtitle">
                On-device AI coding powered by a <strong>Local LLM</strong>.<br>
                Your code never leaves the browser.
              </div>
              <div class="welcome-screen__shortcuts">
                <div class="welcome-screen__shortcut"><kbd>Ctrl+B</kbd> Toggle sidebar</div>
                <div class="welcome-screen__shortcut"><kbd>Ctrl+Shift+A</kbd> Toggle AI panel</div>
                <div class="welcome-screen__shortcut"><kbd>Ctrl+\`</kbd> Toggle terminal</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Bottom Panel (Terminal) -->
        <div class="bottom-panel" id="bottom-panel">
          <div class="bottom-panel__header">
            <span class="bottom-panel__tab active">Terminal</span>
            <span class="bottom-panel__tab">Output</span>
            <div class="bottom-panel__spacer"></div>
            <button class="bottom-panel__toggle" id="toggle-terminal" title="Toggle terminal">✕</button>
          </div>
          <div id="terminal-container"></div>
        </div>
      </div>

      <!-- AI Chat Panel -->
      <div class="ai-panel" id="ai-panel"></div>
    </div>

    <!-- Status Bar -->
    <div class="statusbar">
      <span class="statusbar__item" id="sb-branch">⑂ main</span>
      <span class="statusbar__item" id="sb-errors">⊘ 0</span>
      <span class="statusbar__item" id="sb-warnings">⚠ 0</span>
      <div class="statusbar__spacer"></div>
      <span class="statusbar__item" id="sb-cursor">Ln 1, Col 1</span>
      <span class="statusbar__item" id="sb-lang">—</span>
      <span class="statusbar__item" id="sb-encoding">UTF-8</span>
      <span class="statusbar__item">On-Device AI Engine</span>
    </div>
  `;
}

// ---- File Tree ----
const openFolders = new Set(['/src', '/']);

function renderFileTree() {
  const container = document.getElementById('file-tree');
  const tree = vfs.getTree();
  container.innerHTML = '';
  renderNode(tree, container, 0);
}

function renderNode(node, parent, depth) {
  if (node.type === 'folder') {
    // Sort: folders first, then files
    const sorted = [...node.children].sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'folder' ? -1 : 1;
    });

    // Don't render root folder itself
    if (depth > 0) {
      const isOpen = openFolders.has(node.path);
      const div = document.createElement('div');
      div.className = 'file-tree__item file-tree__item--folder';
      div.innerHTML = `
        ${'<span class="file-tree__indent"></span>'.repeat(depth - 1)}
        <span class="file-tree__icon file-tree__icon--folder">${isOpen ? FOLDER_OPEN_ICON : FOLDER_ICON}</span>
        <span>${node.name}</span>
      `;
      div.addEventListener('click', () => {
        if (openFolders.has(node.path)) openFolders.delete(node.path);
        else openFolders.add(node.path);
        renderFileTree();
      });
      parent.appendChild(div);

      if (!isOpen) return;
    }

    for (const child of sorted) {
      renderNode(child, parent, depth > 0 ? depth + 1 : 1);
    }
  } else {
    const icon = FILE_ICONS[node.language] || '📄';
    const div = document.createElement('div');
    div.className = `file-tree__item${currentFile === node.path ? ' active' : ''}`;
    div.innerHTML = `
      ${'<span class="file-tree__indent"></span>'.repeat(Math.max(0, depth - 1))}
      <span class="file-tree__icon">${icon}</span>
      <span>${node.name}</span>
    `;
    div.addEventListener('click', () => openFile(node.path));
    parent.appendChild(div);
  }
}

// ---- Tabs ----
const openTabs = [];

function renderTabs() {
  const tabBar = document.getElementById('tab-bar');
  tabBar.innerHTML = '';

  openTabs.forEach((path) => {
    const file = vfs.readFile(path);
    if (!file) return;
    const icon = FILE_ICONS[file.language] || '📄';
    const tab = document.createElement('div');
    tab.className = `tab${path === currentFile ? ' active' : ''}`;
    tab.innerHTML = `
      <span>${icon}</span>
      <span>${file.name}</span>
      <span class="tab__close" data-path="${path}">✕</span>
    `;
    tab.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab__close')) {
        closeTab(e.target.dataset.path);
      } else {
        openFile(path);
      }
    });
    tabBar.appendChild(tab);
  });
}

function closeTab(path) {
  const idx = openTabs.indexOf(path);
  if (idx === -1) return;
  openTabs.splice(idx, 1);

  if (currentFile === path) {
    if (openTabs.length > 0) {
      openFile(openTabs[Math.min(idx, openTabs.length - 1)]);
    } else {
      currentFile = null;
      destroyEditor(editorView);
      editorView = null;
      showWelcome();
    }
  }
  renderTabs();
}

// ---- Editor ----
function openFile(path) {
  const file = vfs.readFile(path);
  if (!file) return;

  // Save current file content
  if (editorView && currentFile) {
    const content = editorView.state.doc.toString();
    vfs.writeFile(currentFile, content);
  }

  currentFile = path;
  if (!openTabs.includes(path)) openTabs.push(path);

  // Hide welcome, show editor
  const welcome = document.getElementById('welcome-screen');
  if (welcome) welcome.style.display = 'none';

  // Recreate editor
  const container = document.getElementById('editor-container');

  // Remove old editor view from DOM if present
  if (editorView) {
    destroyEditor(editorView);
    editorView = null;
  }

  // Remove any leftover cm-editor elements but keep welcome screen
  container.querySelectorAll('.cm-editor').forEach(el => el.remove());

  editorView = createEditor(container, file.content, file.language, (newContent) => {
    vfs.writeFile(path, newContent, file.language);
    // Update cursor position in status bar
    if (editorView) {
      const pos = editorView.state.selection.main.head;
      const line = editorView.state.doc.lineAt(pos);
      document.getElementById('sb-cursor').textContent = `Ln ${line.number}, Col ${pos - line.from + 1}`;
    }
  });

  // Update agent context bridge
  editorContext.getView = () => editorView;
  editorContext.getCurrentFile = () => currentFile;
  editorContext.getSelection = () => {
    if (!editorView) return '';
    const sel = editorView.state.selection.main;
    return editorView.state.sliceDoc(sel.from, sel.to);
  };
  editorContext.getFileContent = () => editorView ? editorView.state.doc.toString() : '';
  editorContext.getCursorLine = () => {
    if (!editorView) return 1;
    return editorView.state.doc.lineAt(editorView.state.selection.main.head).number;
  };

  // Update status bar
  document.getElementById('sb-lang').textContent = file.language;
  document.getElementById('sb-cursor').textContent = 'Ln 1, Col 1';

  renderTabs();
  renderFileTree();
}

function showWelcome() {
  const welcome = document.getElementById('welcome-screen');
  if (welcome) welcome.style.display = '';
  document.getElementById('sb-lang').textContent = '—';
  document.getElementById('sb-cursor').textContent = 'Ln 1, Col 1';
}

// ---- Panel Toggles ----
function toggleSidebar() {
  sidebarVisible = !sidebarVisible;
  document.getElementById('sidebar').classList.toggle('collapsed', !sidebarVisible);
  document.getElementById('act-explorer').classList.toggle('active', sidebarVisible);
}

function toggleAIPanel() {
  aiPanelVisible = !aiPanelVisible;
  document.getElementById('ai-panel').classList.toggle('collapsed', !aiPanelVisible);
}

function toggleTerminal() {
  terminalVisible = !terminalVisible;
  document.getElementById('bottom-panel').classList.toggle('collapsed', !terminalVisible);
}

// ---- Keyboard Shortcuts ----
function bindKeyboard() {
  document.addEventListener('keydown', (e) => {
    // Ctrl+B: toggle sidebar
    if (e.ctrlKey && e.key === 'b') {
      e.preventDefault();
      toggleSidebar();
    }
    // Ctrl+Shift+A: toggle AI panel
    if (e.ctrlKey && e.shiftKey && e.key === 'A') {
      e.preventDefault();
      toggleAIPanel();
    }
    // Ctrl+`: toggle terminal
    if (e.ctrlKey && e.key === '`') {
      e.preventDefault();
      toggleTerminal();
    }
    // Ctrl+S: save current file
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      if (editorView && currentFile) {
        vfs.writeFile(currentFile, editorView.state.doc.toString());
      }
    }
  });
}

// Model status binding is done via dynamic import in init()

// ---- Init ----
async function init() {
  buildShell();

  // Init virtual file system
  await vfs.init();
  renderFileTree();
  vfs.onChange(() => renderFileTree());

  // Init chat panel
  const chatPanel = new ChatPanel(document.getElementById('ai-panel'));

  // Init terminal
  const terminal = new Terminal(document.getElementById('terminal-container'));

  // Init agentic features
  const commandPalette = new CommandPalette();
  const inlineActions = new InlineActions();

  // Bind activity bar buttons
  document.getElementById('act-explorer').addEventListener('click', toggleSidebar);
  document.getElementById('act-ai').addEventListener('click', toggleAIPanel);
  document.getElementById('act-terminal').addEventListener('click', toggleTerminal);
  document.getElementById('toggle-terminal').addEventListener('click', toggleTerminal);

  // Bind keyboard shortcuts
  bindKeyboard();

  // Update model status in titlebar
  const { aiEngine } = await import('./ai-engine.js');
  aiEngine.onStatusChange((info) => {
    const el = document.getElementById('titlebar-model-status');
    if (el) el.textContent = info.status === 'ready' ? '✅ AI Ready' : info.message;
  });

  // Open first file automatically
  const tree = vfs.getTree();
  const firstFile = findFirstFile(tree);
  if (firstFile) openFile(firstFile);
}

function findFirstFile(node) {
  if (node.type === 'file') return node.path;
  if (node.children) {
    for (const child of node.children) {
      const result = findFirstFile(child);
      if (result) return result;
    }
  }
  return null;
}

init().catch(console.error);
