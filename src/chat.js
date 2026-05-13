/**
 * chat.js — AI Chat panel with agentic capabilities.
 * Supports: context-aware prompts, Apply Code buttons, Agent mode, diff preview.
 */
import { aiEngine, MODEL_STATUS } from './ai-engine.js';
import { setChatDispatcher, gatherContext, computeDiff, renderDiffHTML, editorContext } from './agent.js';
import { vfs } from './file-system.js';

const MODELS = [
  {
    id: 'gemma3-1b-int4',
    label: 'Gemma 3 1B · int4',
    size: '700 MB',
    badge: '⚡ Fastest',
    url: 'https://huggingface.co/litert-community/Gemma3-1B-IT/resolve/main/gemma3-1b-it-int4-web.task',
  },
  {
    id: 'gemma3-1b-int8',
    label: 'Gemma 3 1B · int8',
    size: '1 GB',
    badge: '',
    url: 'https://huggingface.co/litert-community/Gemma3-1B-IT/resolve/main/gemma3-1b-it-int8-web.task',
  },
  {
    id: 'gemma4-e2b',
    label: 'Gemma 4 E2B',
    size: '2 GB',
    badge: '★ Recommended',
    url: 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.task',
  },
  {
    id: 'gemma4-e4b',
    label: 'Gemma 4 E4B',
    size: '3 GB',
    badge: '🔥 Best',
    url: 'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it-web.task',
  },
];

const DEFAULT_MODEL_ID = 'gemma4-e2b';

export class ChatPanel {
  constructor(container) {
    this.container = container;
    this.messages = [];
    this.agentMode = false;
    this.render();
    this._bindEvents();
    this._updateModelStatus();

    // Register as the chat dispatcher for agent.js
    setChatDispatcher((msg) => this._handleAgentDispatch(msg));

    // Listen for status changes
    aiEngine.onStatusChange(() => this._updateModelStatus());
  }

  render() {
    this.container.innerHTML = `
      <div class="ai-panel__header">
        <div class="ai-panel__header-icon">✦</div>
        <span class="ai-panel__header-title">Nova AI</span>
        <span class="ai-panel__header-badge" id="ai-mode-badge">Chat</span>
        <div class="ai-panel__header-spacer"></div>
        <button class="ai-panel__header-btn" id="ai-agent-btn" title="Toggle Agent Mode">🤖</button>
        <button class="ai-panel__header-btn" id="ai-clear-btn" title="Clear chat">🗑</button>
      </div>

      <div class="ai-panel__model-status" id="model-status-area">
        <div class="model-status__row">
          <div class="model-status__dot model-status__dot--idle" id="model-dot"></div>
          <span class="model-status__label" id="model-status-text">No model loaded</span>
        </div>
        <div class="model-status__row" style="margin-top: 4px;">
          <select id="model-select" style="
            flex: 1; background: var(--bg-primary); border: 1px solid var(--border-primary);
            border-radius: 6px; padding: 6px 10px; color: var(--text-primary);
            font-family: var(--font-mono); font-size: 11px; outline: none; cursor: pointer;
          ">
            ${MODELS.map(m => `
              <option value="${m.id}"${m.id === DEFAULT_MODEL_ID ? ' selected' : ''}>
                ${m.badge ? m.badge + ' ' : ''}${m.label} · ${m.size}
              </option>`).join('')}
          </select>
        </div>
        <div class="model-status__row" style="margin-top: 4px;">
          <button class="model-status__btn model-status__btn--primary" id="model-quickload-btn"
            style="width: 100%; padding: 8px 14px; font-size: 13px;">
            ⬇ Download Gemma 4 E2B (2 GB)
          </button>
        </div>
        <div class="model-status__progress hidden" id="model-progress">
          <div class="model-status__progress-bar" id="model-progress-bar" style="width: 0%"></div>
        </div>
        <div class="model-status__row hidden" id="model-progress-text" style="justify-content: center;">
          <span style="font-size: 10px; color: var(--text-muted);" id="model-progress-label"></span>
        </div>
        <details style="margin-top: 4px;">
          <summary style="font-size: 11px; color: var(--text-muted); cursor: pointer;">
            Advanced: Upload or load from URL
          </summary>
          <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 8px;">
            <div class="model-status__row" style="gap: 8px; flex-wrap: wrap;">
              <input type="file" id="model-file-input" accept=".task,.bin,.tflite" style="display:none">
              <button class="model-status__btn model-status__btn--primary" id="model-upload-btn"
                style="flex: 1;">
                📁 Upload File
              </button>
            </div>
            <div class="model-status__row" style="gap: 6px;">
              <input type="text" id="model-url-input"
                placeholder="https://...model.task"
                style="flex:1; background: var(--bg-primary); border: 1px solid var(--border-primary); 
                       border-radius: 6px; padding: 5px 10px; color: var(--text-primary); 
                       font-family: var(--font-mono); font-size: 11px; outline: none;">
              <button class="model-status__btn model-status__btn--primary" id="model-url-btn" style="padding: 5px 10px;">
                Load
              </button>
            </div>
          </div>
        </details>
      </div>

      <div class="ai-panel__messages" id="chat-messages">
        <div class="chat-msg">
          <div class="chat-msg__avatar chat-msg__avatar--ai">✦</div>
          <div class="chat-msg__body">
            <div class="chat-msg__name">AI Assistant</div>
            <div class="chat-msg__text">
              Welcome! I'm your <strong>Local AI Assistant</strong> running on-device.<br><br>
              <strong>🚀 Quick Actions:</strong><br>
              • Select code → inline actions appear (Explain, Fix, Refactor)<br>
              • <kbd>Ctrl+Shift+P</kbd> — Command Palette<br>
              • <kbd>Ctrl+K</kbd> — Quick AI action<br>
              • Click 🤖 for <strong>Agent Mode</strong> (multi-step tasks)<br><br>
              Load the model to get started. Your data stays private. ✨
            </div>
          </div>
        </div>
      </div>

      <div class="ai-panel__context-bar hidden" id="context-bar">
        <span class="context-bar__icon">📎</span>
        <span class="context-bar__text" id="context-bar-text">No context</span>
        <button class="context-bar__clear" id="context-bar-clear" title="Clear context">✕</button>
      </div>

      <div class="ai-panel__input-area">
        <div class="chat-input">
          <button class="chat-input__context-btn" id="chat-context-btn" title="Attach file context">📎</button>
          <textarea class="chat-input__textarea" id="chat-textarea" 
            placeholder="Ask AI about your code… (Ctrl+Shift+P for commands)" rows="1"></textarea>
          <button class="chat-input__send" id="chat-send-btn" title="Send (Enter)">➤</button>
        </div>
      </div>
    `;
  }

  _bindEvents() {
    // Model selector + download
    const quickloadBtn = this.container.querySelector('#model-quickload-btn');
    const modelSelect = this.container.querySelector('#model-select');

    const updateBtnLabel = () => {
      const model = MODELS.find(m => m.id === modelSelect.value) || MODELS.find(m => m.id === DEFAULT_MODEL_ID);
      quickloadBtn.textContent = `⬇ Download ${model.label} (${model.size})`;
    };
    updateBtnLabel();

    modelSelect.addEventListener('change', updateBtnLabel);

    quickloadBtn.addEventListener('click', async () => {
      const model = MODELS.find(m => m.id === modelSelect.value) || MODELS.find(m => m.id === DEFAULT_MODEL_ID);
      const progressBar = this.container.querySelector('#model-progress-bar');
      const progressDiv = this.container.querySelector('#model-progress');
      const progressText = this.container.querySelector('#model-progress-text');
      const progressLabel = this.container.querySelector('#model-progress-label');

      progressDiv.classList.remove('hidden');
      progressText.classList.remove('hidden');
      progressBar.style.width = '0%';
      progressLabel.textContent = 'Starting download…';

      try {
        await aiEngine.downloadAndLoad(model.url, (received, total) => {
          if (total > 0) {
            const pct = Math.round((received / total) * 100);
            progressBar.style.width = `${pct}%`;
            progressLabel.textContent = `${(received / 1048576).toFixed(0)} MB / ${(total / 1048576).toFixed(0)} MB (${pct}%)`;
          } else {
            progressLabel.textContent = `${(received / 1048576).toFixed(0)} MB downloaded`;
          }
        });
        progressDiv.classList.add('hidden');
        progressText.classList.add('hidden');
      } catch (err) {
        progressDiv.classList.add('hidden');
        progressText.classList.add('hidden');
        this._addMessage('ai', `❌ Download failed: ${err.message}`);
      }
    });

    // Upload model file
    const uploadBtn = this.container.querySelector('#model-upload-btn');
    const fileInput = this.container.querySelector('#model-file-input');
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        await aiEngine.loadModel(file);
      } catch (err) {
        this._addMessage('ai', `❌ Failed to load model: ${err.message}`);
      }
    });

    // Load model from URL
    const urlBtn = this.container.querySelector('#model-url-btn');
    const urlInput = this.container.querySelector('#model-url-input');
    urlBtn.addEventListener('click', async () => {
      const url = urlInput.value.trim();
      if (!url) return;
      try {
        await aiEngine.loadModel(url);
      } catch (err) {
        this._addMessage('ai', `❌ Failed to load model: ${err.message}`);
      }
    });

    // Send message
    const sendBtn = this.container.querySelector('#chat-send-btn');
    const textarea = this.container.querySelector('#chat-textarea');

    sendBtn.addEventListener('click', () => this._sendMessage());
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._sendMessage();
      }
    });

    // Auto-resize textarea
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    });

    // Clear chat
    this.container.querySelector('#ai-clear-btn').addEventListener('click', () => {
      this.messages = [];
      const msgContainer = this.container.querySelector('#chat-messages');
      msgContainer.innerHTML = '';
      this._addMessage('ai', 'Chat cleared. Select code and use inline actions, or ask me anything!');
    });

    // Agent mode toggle
    this.container.querySelector('#ai-agent-btn').addEventListener('click', () => {
      this.agentMode = !this.agentMode;
      const badge = this.container.querySelector('#ai-mode-badge');
      const btn = this.container.querySelector('#ai-agent-btn');
      if (this.agentMode) {
        badge.textContent = 'Agent';
        badge.classList.add('ai-panel__header-badge--agent');
        btn.classList.add('active');
        this._addMessage('ai', '🤖 **Agent Mode activated.** I can now plan multi-step changes across your codebase. Describe what you want to build or change, and I\'ll create a plan first.');
      } else {
        badge.textContent = 'Chat';
        badge.classList.remove('ai-panel__header-badge--agent');
        btn.classList.remove('active');
        this._addMessage('ai', '💬 Switched back to Chat mode.');
      }
    });

    // Context attach button
    this.container.querySelector('#chat-context-btn').addEventListener('click', () => {
      const ctx = gatherContext();
      const bar = this.container.querySelector('#context-bar');
      const barText = this.container.querySelector('#context-bar-text');

      if (ctx.selection) {
        barText.textContent = `${ctx.fileName} (${ctx.selection.split('\n').length} lines selected)`;
      } else {
        barText.textContent = `${ctx.fileName} (full file)`;
      }
      bar.classList.remove('hidden');
      this._attachedContext = ctx;
    });

    // Clear context
    this.container.querySelector('#context-bar-clear').addEventListener('click', () => {
      this.container.querySelector('#context-bar').classList.add('hidden');
      this._attachedContext = null;
    });
  }

  // ---- Agent Dispatch Handler ----
  _handleAgentDispatch({ systemMessage, prompt, actionType }) {
    if (systemMessage) {
      this._addMessage('ai', systemMessage);
      return;
    }

    if (actionType === 'agent') {
      // Activate agent mode
      this.agentMode = true;
      const badge = this.container.querySelector('#ai-mode-badge');
      badge.textContent = 'Agent';
      badge.classList.add('ai-panel__header-badge--agent');
      this._addMessage('ai', '🤖 **Agent Mode activated.** Describe the task you want me to accomplish across your codebase.');
      return;
    }

    if (prompt) {
      this._sendPromptDirectly(prompt, actionType);
    }
  }

  // ---- Send Methods ----
  async _sendMessage() {
    const textarea = this.container.querySelector('#chat-textarea');
    const text = textarea.value.trim();
    if (!text) return;

    textarea.value = '';
    textarea.style.height = 'auto';

    // Build context-enriched prompt
    let enrichedPrompt = text;
    const ctx = this._attachedContext || gatherContext();

    if (this.agentMode) {
      enrichedPrompt = this._buildAgentPrompt(text, ctx);
    } else if (ctx.selection) {
      enrichedPrompt = `Context — File: ${ctx.fileName} (${ctx.language})\nSelected code:\n\`\`\`${ctx.language}\n${ctx.selection}\n\`\`\`\n\nUser request: ${text}`;
    } else if (ctx.fileContent) {
      enrichedPrompt = `Context — File: ${ctx.fileName} (${ctx.language}), Cursor at line ${ctx.cursorLine}\n\nUser request: ${text}`;
    }

    // Show user message (only the original text, not enriched)
    this._addMessage('user', text, ctx);

    // Clear attached context
    this.container.querySelector('#context-bar').classList.add('hidden');
    this._attachedContext = null;

    if (!aiEngine.isReady) {
      this._addMessage('ai', '⚠️ Please load a model first using the panel above.');
      return;
    }

    await this._generateResponse(enrichedPrompt);
  }

  async _sendPromptDirectly(prompt, actionType) {
    const ctx = gatherContext();
    const actionLabels = {
      explain: '💡 Explain', fix: '🔧 Fix', refactor: '♻️ Refactor',
      document: '📝 Document', tests: '🧪 Tests', optimize: '⚡ Optimize',
      complete: '✦ Complete',
    };
    const label = actionLabels[actionType] || '✦ AI Action';

    // Show a compact user message for the action
    this._addActionMessage(label, ctx);

    if (!aiEngine.isReady) {
      this._addMessage('ai', '⚠️ Please load a model first.');
      return;
    }

    await this._generateResponse(prompt, actionType);
  }

  async _generateResponse(prompt, actionType) {
    const typingEl = this._addTypingIndicator();

    try {
      const msgEl = this._addMessage('ai', '');
      const textEl = msgEl.querySelector('.chat-msg__text');
      typingEl.remove();

      let fullResponse = '';
      await aiEngine.generate(prompt, (partial) => {
        fullResponse = partial;
        textEl.innerHTML = this._formatMarkdown(partial);
        this._scrollToBottom();
      });

      // After generation, add "Apply" buttons if code blocks are present
      this._addApplyButtons(msgEl, fullResponse, actionType);

    } catch (err) {
      typingEl.remove();
      this._addMessage('ai', `❌ Error: ${err.message}`);
    }
  }

  _buildAgentPrompt(task, ctx) {
    const fileList = ctx.allFiles.join('\n  ');
    return `You are an AI coding agent inside an IDE. You can read and modify files.

Workspace files:
  ${fileList}

Current file: ${ctx.fileName} (${ctx.language})
Cursor line: ${ctx.cursorLine}
${ctx.selection ? `Selected code:\n\`\`\`${ctx.language}\n${ctx.selection}\n\`\`\`` : ''}

Task: ${task}

Respond with a structured plan:
1. List the steps you will take
2. For each step, show the code changes in a code block
3. Explain your reasoning

Use code blocks with the target filename as a comment on the first line.`;
  }

  // ---- Apply Code to Editor ----
  _addApplyButtons(msgEl, response, actionType) {
    // Find code blocks in the response
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let match;
    const blocks = [];
    while ((match = codeBlockRegex.exec(response)) !== null) {
      blocks.push({ lang: match[1], code: match[2].trim() });
    }

    if (blocks.length === 0) return;

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'chat-msg__actions';

    blocks.forEach((block, i) => {
      // Apply button
      const applyBtn = document.createElement('button');
      applyBtn.className = 'chat-msg__action-btn chat-msg__action-btn--apply';
      applyBtn.innerHTML = `✦ Apply${blocks.length > 1 ? ` Block ${i + 1}` : ''}`;
      applyBtn.addEventListener('click', () => {
        this._applyCode(block.code, actionType);
        applyBtn.textContent = '✅ Applied';
        applyBtn.disabled = true;
      });
      actionsDiv.appendChild(applyBtn);

      // Diff button
      const diffBtn = document.createElement('button');
      diffBtn.className = 'chat-msg__action-btn chat-msg__action-btn--diff';
      diffBtn.innerHTML = `📊 Diff`;
      diffBtn.addEventListener('click', () => {
        this._showDiff(block.code);
      });
      actionsDiv.appendChild(diffBtn);

      // Copy button
      const copyBtn = document.createElement('button');
      copyBtn.className = 'chat-msg__action-btn';
      copyBtn.innerHTML = `📋 Copy`;
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(block.code);
        copyBtn.textContent = '✅ Copied';
        setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 1500);
      });
      actionsDiv.appendChild(copyBtn);
    });

    const body = msgEl.querySelector('.chat-msg__body');
    body.appendChild(actionsDiv);
  }

  _applyCode(code, actionType) {
    const view = editorContext.getView();
    if (!view) return;

    const state = view.state;
    const sel = state.selection.main;

    if (sel.from !== sel.to && ['fix', 'refactor', 'document', 'optimize'].includes(actionType)) {
      // Replace the selection with the new code
      view.dispatch({
        changes: { from: sel.from, to: sel.to, insert: code },
      });
    } else {
      // Replace entire file content
      view.dispatch({
        changes: { from: 0, to: state.doc.length, insert: code },
      });
    }
  }

  _showDiff(newCode) {
    const ctx = gatherContext();
    const original = ctx.selection || ctx.fileContent;
    const diff = computeDiff(original, newCode);
    const diffHtml = renderDiffHTML(diff);

    // Show diff in a message
    this._addRawMessage('ai', `<div class="chat-msg__diff-header">📊 Proposed Changes</div>${diffHtml}`);
  }

  // ---- Message Rendering ----
  _addMessage(role, text, context) {
    const msgContainer = this.container.querySelector('#chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg';

    const isUser = role === 'user';

    let contextBadge = '';
    if (isUser && context && context.fileName) {
      contextBadge = `<span class="chat-msg__context-badge">📎 ${context.fileName}${context.selection ? ` (${context.selection.split('\n').length} lines)` : ''}</span>`;
    }

    div.innerHTML = `
      <div class="chat-msg__avatar ${isUser ? 'chat-msg__avatar--user' : 'chat-msg__avatar--ai'}">
        ${isUser ? '👤' : '✦'}
      </div>
      <div class="chat-msg__body">
        <div class="chat-msg__name">${isUser ? 'You' : (this.agentMode ? '🤖 Agent' : 'AI Assistant')}</div>
        ${contextBadge}
        <div class="chat-msg__text">${this._formatMarkdown(text)}</div>
      </div>
    `;

    msgContainer.appendChild(div);
    this._scrollToBottom();
    return div;
  }

  _addActionMessage(label, ctx) {
    const msgContainer = this.container.querySelector('#chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg chat-msg--action';
    div.innerHTML = `
      <div class="chat-msg__avatar chat-msg__avatar--user">👤</div>
      <div class="chat-msg__body">
        <div class="chat-msg__name">You</div>
        <div class="chat-msg__action-tag">${label}</div>
        <span class="chat-msg__context-badge">📎 ${ctx.fileName} · ${ctx.selection.split('\n').length} lines</span>
      </div>
    `;
    msgContainer.appendChild(div);
    this._scrollToBottom();
  }

  _addRawMessage(role, html) {
    const msgContainer = this.container.querySelector('#chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `
      <div class="chat-msg__avatar chat-msg__avatar--ai">✦</div>
      <div class="chat-msg__body">
        <div class="chat-msg__text">${html}</div>
      </div>
    `;
    msgContainer.appendChild(div);
    this._scrollToBottom();
  }

  _addTypingIndicator() {
    const msgContainer = this.container.querySelector('#chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `
      <div class="chat-msg__avatar chat-msg__avatar--ai">✦</div>
      <div class="chat-msg__body">
        <div class="chat-msg__name">${this.agentMode ? '🤖 Agent' : 'AI Assistant'}</div>
        <div class="chat-msg__typing">
          <div class="chat-msg__typing-dot"></div>
          <div class="chat-msg__typing-dot"></div>
          <div class="chat-msg__typing-dot"></div>
        </div>
      </div>
    `;
    msgContainer.appendChild(div);
    this._scrollToBottom();
    return div;
  }

  _scrollToBottom() {
    const el = this.container.querySelector('#chat-messages');
    el.scrollTop = el.scrollHeight;
  }

  _updateModelStatus() {
    const dot = this.container.querySelector('#model-dot');
    const statusText = this.container.querySelector('#model-status-text');
    if (!dot || !statusText) return;

    dot.className = 'model-status__dot';

    switch (aiEngine.status) {
      case MODEL_STATUS.IDLE:
        dot.classList.add('model-status__dot--idle');
        break;
      case MODEL_STATUS.DOWNLOADING:
      case MODEL_STATUS.LOADING:
      case MODEL_STATUS.GENERATING:
        dot.classList.add('model-status__dot--loading');
        break;
      case MODEL_STATUS.READY:
        dot.classList.add('model-status__dot--ready');
        break;
      case MODEL_STATUS.ERROR:
        dot.classList.add('model-status__dot--error');
        break;
    }

    statusText.textContent = aiEngine.statusMessage;

    const btns = this.container.querySelectorAll('.model-status__btn--primary');
    const isLoading = [MODEL_STATUS.DOWNLOADING, MODEL_STATUS.LOADING].includes(aiEngine.status);
    btns.forEach(btn => btn.disabled = isLoading);
  }

  _formatMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="code-block"><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }
}
