/**
 * agent.js — Agentic coding capabilities for Nova IDE.
 * Provides: Command Palette, Inline Actions, Context Gathering, Diff Engine, Agent Mode.
 */
import { aiEngine } from './ai-engine.js';
import { vfs } from './file-system.js';

// ---- Editor Context Bridge ----
// main.js will set these so the agent can read editor state
export const editorContext = {
  getView: () => null,
  getCurrentFile: () => null,
  getSelection: () => '',
  getCursorLine: () => 1,
  getFileContent: () => '',
  replaceSelection: () => {},
  replaceAll: () => {},
  insertAt: () => {},
};

// ---- Command Palette ----
export class CommandPalette {
  constructor() {
    this.visible = false;
    this.commands = this._buildCommands();
    this._injectDOM();
    this._bind();
  }

  _buildCommands() {
    return [
      { id: 'explain',    icon: '💡', label: 'Explain Selection',          category: 'AI',     action: () => this._aiAction('explain') },
      { id: 'fix',        icon: '🔧', label: 'Fix Selected Code',          category: 'AI',     action: () => this._aiAction('fix') },
      { id: 'refactor',   icon: '♻️', label: 'Refactor Selection',         category: 'AI',     action: () => this._aiAction('refactor') },
      { id: 'document',   icon: '📝', label: 'Add Documentation',          category: 'AI',     action: () => this._aiAction('document') },
      { id: 'tests',      icon: '🧪', label: 'Generate Tests',             category: 'AI',     action: () => this._aiAction('tests') },
      { id: 'optimize',   icon: '⚡', label: 'Optimize Performance',       category: 'AI',     action: () => this._aiAction('optimize') },
      { id: 'complete',   icon: '✦',  label: 'Complete Code at Cursor',    category: 'AI',     action: () => this._aiAction('complete') },
      { id: 'agent',      icon: '🤖', label: 'Agent Mode: Plan & Execute', category: 'Agent',  action: () => this._agentMode() },
      { id: 'newfile',    icon: '📄', label: 'New File',                   category: 'File',   action: () => this._newFile() },
      { id: 'save',       icon: '💾', label: 'Save Current File',          category: 'File',   action: () => this._save() },
      { id: 'toggleAI',   icon: '✦',  label: 'Toggle AI Panel',           category: 'View',   action: () => document.getElementById('act-ai')?.click() },
      { id: 'toggleTerm', icon: '⌨',  label: 'Toggle Terminal',           category: 'View',   action: () => document.getElementById('act-terminal')?.click() },
    ];
  }

  _injectDOM() {
    const overlay = document.createElement('div');
    overlay.id = 'command-palette-overlay';
    overlay.className = 'cmd-palette-overlay hidden';
    overlay.innerHTML = `
      <div class="cmd-palette">
        <div class="cmd-palette__input-row">
          <span class="cmd-palette__icon">⚡</span>
          <input type="text" class="cmd-palette__input" id="cmd-input"
            placeholder="Type a command or AI action…" autocomplete="off" spellcheck="false">
        </div>
        <div class="cmd-palette__list" id="cmd-list"></div>
        <div class="cmd-palette__footer">
          <span><kbd>↑↓</kbd> Navigate</span>
          <span><kbd>Enter</kbd> Run</span>
          <span><kbd>Esc</kbd> Close</span>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  _bind() {
    const overlay = document.getElementById('command-palette-overlay');
    const input = document.getElementById('cmd-input');

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.hide();
    });

    // Filter commands
    input.addEventListener('input', () => this._renderList(input.value));

    // Keyboard nav
    input.addEventListener('keydown', (e) => {
      const items = document.querySelectorAll('.cmd-palette__item');
      const active = document.querySelector('.cmd-palette__item.active');
      const idx = [...items].indexOf(active);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (active) active.classList.remove('active');
        const next = items[Math.min(idx + 1, items.length - 1)];
        if (next) next.classList.add('active');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (active) active.classList.remove('active');
        const prev = items[Math.max(idx - 1, 0)];
        if (prev) prev.classList.add('active');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (active) active.click();
      } else if (e.key === 'Escape') {
        this.hide();
      }
    });

    // Global shortcut
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        this.toggle();
      }
      // Ctrl+K for quick inline action
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        this.show();
      }
    });
  }

  _renderList(filter = '') {
    const list = document.getElementById('cmd-list');
    const query = filter.toLowerCase();
    const filtered = this.commands.filter(c =>
      c.label.toLowerCase().includes(query) || c.category.toLowerCase().includes(query)
    );

    list.innerHTML = '';
    let currentCategory = '';

    filtered.forEach((cmd, i) => {
      if (cmd.category !== currentCategory) {
        currentCategory = cmd.category;
        const header = document.createElement('div');
        header.className = 'cmd-palette__category';
        header.textContent = currentCategory;
        list.appendChild(header);
      }

      const item = document.createElement('div');
      item.className = `cmd-palette__item${i === 0 ? ' active' : ''}`;
      item.innerHTML = `
        <span class="cmd-palette__item-icon">${cmd.icon}</span>
        <span class="cmd-palette__item-label">${cmd.label}</span>
        <span class="cmd-palette__item-badge">${cmd.category}</span>
      `;
      item.addEventListener('click', () => {
        this.hide();
        cmd.action();
      });
      item.addEventListener('mouseenter', () => {
        list.querySelectorAll('.cmd-palette__item.active').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
      });
      list.appendChild(item);
    });
  }

  show() {
    const overlay = document.getElementById('command-palette-overlay');
    const input = document.getElementById('cmd-input');
    overlay.classList.remove('hidden');
    input.value = '';
    this._renderList();
    requestAnimationFrame(() => input.focus());
    this.visible = true;
  }

  hide() {
    document.getElementById('command-palette-overlay').classList.add('hidden');
    this.visible = false;
  }

  toggle() {
    this.visible ? this.hide() : this.show();
  }

  // ---- AI Actions ----
  async _aiAction(type) {
    const ctx = gatherContext();
    if (!ctx.selection && ['explain', 'fix', 'refactor', 'document', 'tests', 'optimize'].includes(type)) {
      dispatchToChat('⚠️ Select some code first, then use this action.');
      return;
    }

    const prompts = {
      explain:  `Explain this code concisely:\n\n\`\`\`${ctx.language}\n${ctx.selection}\n\`\`\``,
      fix:      `Fix any bugs in this code. Return the corrected code in a code block:\n\n\`\`\`${ctx.language}\n${ctx.selection}\n\`\`\``,
      refactor: `Refactor this code for clarity and best practices. Return the improved code in a code block:\n\n\`\`\`${ctx.language}\n${ctx.selection}\n\`\`\``,
      document: `Add comprehensive documentation/comments to this code. Return the documented code in a code block:\n\n\`\`\`${ctx.language}\n${ctx.selection}\n\`\`\``,
      tests:    `Generate unit tests for this code. Return the tests in a code block:\n\n\`\`\`${ctx.language}\n${ctx.selection}\n\`\`\``,
      optimize: `Optimize this code for performance. Return the optimized code in a code block:\n\n\`\`\`${ctx.language}\n${ctx.selection}\n\`\`\``,
      complete: `Complete the code at the cursor position. Context:\n\nFile: ${ctx.fileName}\nLanguage: ${ctx.language}\nCurrent cursor line: ${ctx.cursorLine}\n\n\`\`\`${ctx.language}\n${ctx.fileContent}\n\`\`\`\n\nProvide the completion in a code block.`,
    };

    dispatchToChat(null, prompts[type], type);
  }

  async _agentMode() {
    dispatchToChat(null, null, 'agent');
  }

  _newFile() {
    const name = prompt('Enter file name (e.g. utils.js):');
    if (!name) return;
    const path = `/src/${name}`;
    vfs.writeFile(path, `// ${name}\n`);
  }

  _save() {
    const view = editorContext.getView();
    const file = editorContext.getCurrentFile();
    if (view && file) {
      vfs.writeFile(file, view.state.doc.toString());
    }
  }
}

// ---- Context Gathering ----
export function gatherContext() {
  const view = editorContext.getView();
  const filePath = editorContext.getCurrentFile();
  const file = filePath ? vfs.readFile(filePath) : null;

  let selection = '';
  let cursorLine = 1;
  let fileContent = '';

  if (view) {
    const state = view.state;
    const sel = state.selection.main;
    selection = state.sliceDoc(sel.from, sel.to);
    cursorLine = state.doc.lineAt(sel.head).number;
    fileContent = state.doc.toString();
  }

  return {
    fileName: file?.name || 'untitled',
    filePath: filePath || '',
    language: file?.language || 'text',
    selection,
    cursorLine,
    fileContent,
    allFiles: [...vfs.files.keys()],
  };
}

// ---- Inline Code Actions (Context Menu) ----
export class InlineActions {
  constructor() {
    this._injectDOM();
    this._bind();
  }

  _injectDOM() {
    const menu = document.createElement('div');
    menu.id = 'inline-actions-menu';
    menu.className = 'inline-actions hidden';
    menu.innerHTML = `
      <button class="inline-actions__btn" data-action="explain">💡 Explain</button>
      <button class="inline-actions__btn" data-action="fix">🔧 Fix</button>
      <button class="inline-actions__btn" data-action="refactor">♻️ Refactor</button>
      <button class="inline-actions__btn" data-action="document">📝 Document</button>
      <button class="inline-actions__btn" data-action="tests">🧪 Tests</button>
    `;
    document.body.appendChild(menu);
  }

  _bind() {
    const menu = document.getElementById('inline-actions-menu');

    // Show on text selection in editor (via mouseup)
    document.addEventListener('mouseup', (e) => {
      // Small delay to let selection finalize
      setTimeout(() => {
        const view = editorContext.getView();
        if (!view) return;

        const sel = view.state.selection.main;
        const hasSelection = sel.from !== sel.to;

        if (hasSelection && view.dom.contains(e.target)) {
          const coords = view.coordsAtPos(sel.to);
          if (coords) {
            menu.style.top = `${coords.bottom + 6}px`;
            menu.style.left = `${coords.left}px`;
            menu.classList.remove('hidden');
          }
        } else {
          menu.classList.add('hidden');
        }
      }, 150);
    });

    // Hide on click outside
    document.addEventListener('mousedown', (e) => {
      if (!menu.contains(e.target)) {
        menu.classList.add('hidden');
      }
    });

    // Handle action clicks
    menu.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      menu.classList.add('hidden');
      const action = btn.dataset.action;
      const ctx = gatherContext();
      const prompts = {
        explain:  `Explain this code:\n\n\`\`\`${ctx.language}\n${ctx.selection}\n\`\`\``,
        fix:      `Fix bugs in this code. Return corrected code in a code block:\n\n\`\`\`${ctx.language}\n${ctx.selection}\n\`\`\``,
        refactor: `Refactor this code. Return improved code in a code block:\n\n\`\`\`${ctx.language}\n${ctx.selection}\n\`\`\``,
        document: `Add documentation to this code. Return documented code in a code block:\n\n\`\`\`${ctx.language}\n${ctx.selection}\n\`\`\``,
        tests:    `Generate tests for this code:\n\n\`\`\`${ctx.language}\n${ctx.selection}\n\`\`\``,
      };
      dispatchToChat(null, prompts[action], action);
    });
  }
}

// ---- Diff Engine ----
export function computeDiff(original, modified) {
  const origLines = original.split('\n');
  const modLines = modified.split('\n');
  const diff = [];
  const maxLen = Math.max(origLines.length, modLines.length);

  for (let i = 0; i < maxLen; i++) {
    const o = origLines[i];
    const m = modLines[i];

    if (o === undefined) {
      diff.push({ type: 'added', line: i + 1, content: m });
    } else if (m === undefined) {
      diff.push({ type: 'removed', line: i + 1, content: o });
    } else if (o !== m) {
      diff.push({ type: 'removed', line: i + 1, content: o });
      diff.push({ type: 'added', line: i + 1, content: m });
    } else {
      diff.push({ type: 'unchanged', line: i + 1, content: o });
    }
  }
  return diff;
}

export function renderDiffHTML(diff) {
  return `<div class="diff-view">${diff.map(d => {
    const cls = d.type === 'added' ? 'diff-added' : d.type === 'removed' ? 'diff-removed' : 'diff-unchanged';
    const prefix = d.type === 'added' ? '+' : d.type === 'removed' ? '-' : ' ';
    return `<div class="diff-line ${cls}"><span class="diff-prefix">${prefix}</span><span class="diff-content">${escapeHtml(d.content)}</span></div>`;
  }).join('')}</div>`;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---- Chat Dispatch ----
// This will be set by chat.js to receive agentic commands
let _chatDispatcher = null;

export function setChatDispatcher(fn) {
  _chatDispatcher = fn;
}

function dispatchToChat(systemMessage, prompt, actionType) {
  if (_chatDispatcher) {
    _chatDispatcher({ systemMessage, prompt, actionType });
  }
}
