/**
 * chat.js - AI Chat panel with explicit coding modes, proposals, and agent timeline.
 */
import { aiEngine, MODEL_STATUS } from './ai-engine.js';
import { setChatDispatcher, gatherContext, computeDiff, renderDiffHTML, editorContext } from './agent.js';
import { LocalAgentFramework } from './agent-framework.js';
import { proposalManager } from './change-manager.js';
import { formatWorkspaceContext, getFunctionSnippet, getRelevantWorkspaceContext, searchExactSymbol } from './workspace-index.js';

export const AI_MODES = {
  ASK: 'ask',
  EDIT: 'edit',
  AGENT: 'agent',
  ARCHITECT: 'architect',
};

const MODE_LABELS = {
  [AI_MODES.ASK]: 'Ask',
  [AI_MODES.EDIT]: 'Edit',
  [AI_MODES.AGENT]: 'Agent',
  [AI_MODES.ARCHITECT]: 'Architect',
};

const APPLY_ACTIONS = new Set([
  AI_MODES.EDIT,
  'fix',
  'refactor',
  'document',
  'tests',
  'optimize',
  'complete',
]);

const MODELS = [
  {
    id: 'gemma4-e2b',
    label: 'Gemma 4 E2B LiteRT LM',
    size: '2 GB',
    badge: 'Recommended',
    filename: 'gemma-4-E2B-it-web.litertlm',
    url: 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.litertlm',
  },
  {
    id: 'gemma4-e4b',
    label: 'Gemma 4 E4B LiteRT LM',
    size: '3 GB',
    badge: 'Best',
    filename: 'gemma-4-E4B-it-web.litertlm',
    url: 'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it-web.litertlm',
  },
];

const DEFAULT_MODEL_ID = 'gemma4-e2b';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function diffStats(before, after) {
  const diff = computeDiff(before || '', after || '');
  return {
    added: diff.filter(line => line.type === 'added').length,
    removed: diff.filter(line => line.type === 'removed').length,
  };
}

export class ChatPanel {
  constructor(container) {
    this.container = container;
    this.messages = [];
    this.aiMode = AI_MODES.ASK;
    this.activeRunId = null;
    this.render();
    this._bindEvents();
    this._updateModeUI();
    this._updateModelStatus();

    setChatDispatcher((msg) => this._handleAgentDispatch(msg));
    aiEngine.onStatusChange(() => this._updateModelStatus());
    proposalManager.onChange((event) => this._handleProposalEvent(event));
  }

  render() {
    this.container.innerHTML = `
      <div class="ai-panel__header">
        <div class="ai-panel__header-icon">AI</div>
        <span class="ai-panel__header-title">Nova AI</span>
        <span class="ai-panel__header-badge" id="ai-mode-badge">Ask</span>
        <div class="ai-panel__header-spacer"></div>
        <button class="ai-panel__header-btn" id="ai-clear-btn" title="Clear chat">Clear</button>
      </div>

      <div class="ai-panel__modes" id="ai-mode-switcher">
        ${Object.entries(MODE_LABELS).map(([mode, label]) => `
          <button class="ai-panel__mode-btn" data-mode="${mode}" title="${label} mode">${label}</button>
        `).join('')}
      </div>

      <div class="ai-panel__model-status" id="model-status-area">
        <div class="model-status__row">
          <div class="model-status__dot model-status__dot--idle" id="model-dot"></div>
          <span class="model-status__label" id="model-status-text">No model loaded</span>
        </div>
        <div class="model-status__row" style="margin-top: 4px;">
          <select id="model-select" class="model-status__select">
            ${MODELS.map(m => `
              <option value="${m.id}"${m.id === DEFAULT_MODEL_ID ? ' selected' : ''}>
                ${m.badge ? `${m.badge} - ` : ''}${m.label} - ${m.size}
              </option>`).join('')}
          </select>
        </div>
        <div class="model-status__row" style="margin-top: 4px;">
          <button class="model-status__btn model-status__btn--primary" id="model-quickload-btn">
            Download Model
          </button>
        </div>
        <div class="model-status__row" style="margin-top: 4px; gap: 6px;">
          <input type="checkbox" id="model-persist-check" style="cursor: pointer;">
          <label for="model-persist-check" style="font-size: 11px; color: var(--text-secondary); cursor: pointer;">
            Save to local disk (OPFS)
          </label>
        </div>
        <div class="model-status__progress hidden" id="model-progress">
          <div class="model-status__progress-bar" id="model-progress-bar" style="width: 0%"></div>
        </div>
        <div class="model-status__row hidden" id="model-progress-text" style="justify-content: center;">
          <span style="font-size: 10px; color: var(--text-muted);" id="model-progress-label"></span>
        </div>
        <details style="margin-top: 4px;">
          <summary style="font-size: 11px; color: var(--text-muted); cursor: pointer;">
            Advanced: upload or load from URL
          </summary>
          <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 8px;">
            <div class="model-status__row" style="gap: 8px; flex-wrap: wrap;">
              <input type="file" id="model-file-input" accept=".litertlm" style="display:none">
              <button class="model-status__btn model-status__btn--primary" id="model-upload-btn" style="flex: 1;">
                Upload File
              </button>
            </div>
            <div class="model-status__row" style="gap: 6px;">
              <input type="text" id="model-url-input" placeholder="https://...model.litertlm" class="model-status__url">
              <button class="model-status__btn model-status__btn--primary" id="model-url-btn" style="padding: 5px 10px;">
                Load
              </button>
            </div>
          </div>
        </details>
      </div>

      <div class="ai-panel__messages" id="chat-messages">
        <div class="chat-msg">
          <div class="chat-msg__avatar chat-msg__avatar--ai">AI</div>
          <div class="chat-msg__body">
            <div class="chat-msg__name">Nova AI</div>
            <div class="chat-msg__text">
              Local coding assistant is ready. Choose Ask, Edit, Agent, or Architect mode, then load a LiteRT LM model.
              Agent changes are proposed first so you can review them before they touch disk.
            </div>
          </div>
        </div>
      </div>

      <div class="ai-panel__context-bar hidden" id="context-bar">
        <span class="context-bar__icon">CTX</span>
        <span class="context-bar__text" id="context-bar-text">No context</span>
        <button class="context-bar__clear" id="context-bar-clear" title="Clear context">x</button>
      </div>

      <div class="ai-panel__input-area">
        <div class="chat-input">
          <button class="chat-input__context-btn" id="chat-context-btn" title="Attach file context">+</button>
          <textarea class="chat-input__textarea" id="chat-textarea"
            placeholder="Ask about your code, request an edit, or assign an agent task..." rows="1"></textarea>
          <button class="chat-input__send" id="chat-send-btn" title="Send (Enter)">Go</button>
        </div>
      </div>
    `;
  }

  _bindEvents() {
    const modelSelect = this.container.querySelector('#model-select');
    const persistCheck = this.container.querySelector('#model-persist-check');
    const quickloadBtn = this.container.querySelector('#model-quickload-btn');

    const updateBtnLabel = async () => {
      const model = MODELS.find(m => m.id === modelSelect.value) || MODELS.find(m => m.id === DEFAULT_MODEL_ID);
      const filename = model.filename || model.url.split('/').pop();
      model.localModel = window.novaDesktop?.findLocalModel
        ? await window.novaDesktop.findLocalModel(filename)
        : null;
      const cached = await aiEngine.getCachedModel(filename);

      if (model.localModel) {
        quickloadBtn.textContent = `Load ${model.label} from ${model.localModel.path}`;
        persistCheck.checked = true;
      } else if (cached) {
        quickloadBtn.textContent = `Load ${model.label} from Local Disk`;
        persistCheck.checked = true;
      } else {
        quickloadBtn.textContent = `Download ${model.label} (${model.size})`;
      }
    };
    updateBtnLabel();

    modelSelect.addEventListener('change', updateBtnLabel);
    quickloadBtn.addEventListener('click', async () => this._downloadSelectedModel(updateBtnLabel));

    const uploadBtn = this.container.querySelector('#model-upload-btn');
    const fileInput = this.container.querySelector('#model-file-input');
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        await aiEngine.loadModel(file);
      } catch (err) {
        this._addMessage('ai', `Failed to load model: ${err.message}`);
      }
    });

    this.container.querySelector('#model-url-btn').addEventListener('click', async () => {
      const url = this.container.querySelector('#model-url-input').value.trim();
      if (!url) return;
      try {
        await aiEngine.loadModel(url);
      } catch (err) {
        this._addMessage('ai', `Failed to load model: ${err.message}`);
      }
    });

    this.container.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => this.setMode(btn.dataset.mode));
    });

    this.container.querySelector('#ai-clear-btn').addEventListener('click', () => {
      this.messages = [];
      this.container.querySelector('#chat-messages').innerHTML = '';
      this._addMessage('ai', 'Chat cleared. Pick a mode and send a task.');
    });

    const sendBtn = this.container.querySelector('#chat-send-btn');
    const textarea = this.container.querySelector('#chat-textarea');
    sendBtn.addEventListener('click', () => this._sendMessage());
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._sendMessage();
      }
    });
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    });

    this.container.querySelector('#chat-context-btn').addEventListener('click', () => this._attachContext());
    this.container.querySelector('#context-bar-clear').addEventListener('click', () => {
      this.container.querySelector('#context-bar').classList.add('hidden');
      this._attachedContext = null;
    });
  }

  setMode(mode) {
    this.aiMode = Object.values(AI_MODES).includes(mode) ? mode : AI_MODES.ASK;
    this._updateModeUI();
    const hints = {
      [AI_MODES.ASK]: 'Ask mode is read-only. I will explain and answer using workspace context.',
      [AI_MODES.EDIT]: 'Edit mode focuses on the current selection or file and returns changes you can apply.',
      [AI_MODES.AGENT]: 'Agent mode can inspect the workspace and propose multi-file changes for review.',
      [AI_MODES.ARCHITECT]: 'Architect mode produces plans, structure, and design guidance without writing files.',
    };
    this._addMessage('ai', hints[this.aiMode]);
  }

  _updateModeUI() {
    const badge = this.container.querySelector('#ai-mode-badge');
    if (badge) {
      badge.textContent = MODE_LABELS[this.aiMode];
      badge.className = `ai-panel__header-badge ai-panel__header-badge--${this.aiMode}`;
    }

    this.container.querySelectorAll('[data-mode]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === this.aiMode);
    });
  }

  async _downloadSelectedModel(updateBtnLabel) {
    const modelSelect = this.container.querySelector('#model-select');
    const persistCheck = this.container.querySelector('#model-persist-check');
    const model = MODELS.find(m => m.id === modelSelect.value) || MODELS.find(m => m.id === DEFAULT_MODEL_ID);
    const progressBar = this.container.querySelector('#model-progress-bar');
    const progressDiv = this.container.querySelector('#model-progress');
    const progressText = this.container.querySelector('#model-progress-text');
    const progressLabel = this.container.querySelector('#model-progress-label');

    progressDiv.classList.remove('hidden');
    progressText.classList.remove('hidden');
    progressBar.style.width = '0%';
    progressLabel.textContent = 'Starting download...';

    try {
      if (model.localModel?.url) {
        progressLabel.textContent = `Loading ${model.localModel.path}`;
        await aiEngine.loadModel(model.localModel.url);
        progressDiv.classList.add('hidden');
        progressText.classList.add('hidden');
        updateBtnLabel();
        return;
      }

      await aiEngine.downloadAndLoad(model.url, persistCheck.checked, (received, total) => {
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
      updateBtnLabel();
    } catch (err) {
      progressDiv.classList.add('hidden');
      progressText.classList.add('hidden');
      this._addMessage('ai', `Download failed: ${err.message}`);
    }
  }

  _attachContext() {
    const ctx = gatherContext();
    const bar = this.container.querySelector('#context-bar');
    const barText = this.container.querySelector('#context-bar-text');

    if (ctx.selection) {
      barText.textContent = `${ctx.fileName} (${ctx.selection.split('\n').length} selected lines)`;
    } else {
      barText.textContent = `${ctx.fileName} (full file)`;
    }
    bar.classList.remove('hidden');
    this._attachedContext = ctx;
  }

  _handleAgentDispatch({ systemMessage, prompt, actionType }) {
    if (systemMessage) {
      this._addMessage('ai', systemMessage);
      return;
    }

    if (actionType === 'agent') {
      this.setMode(AI_MODES.AGENT);
      return;
    }

    if (actionType?.startsWith('mode:')) {
      this.setMode(actionType.replace('mode:', ''));
      return;
    }

    if (prompt) {
      this._sendPromptDirectly(prompt, actionType);
    }
  }

  async _sendMessage() {
    const textarea = this.container.querySelector('#chat-textarea');
    const text = textarea.value.trim();
    if (!text) return;

    textarea.value = '';
    textarea.style.height = 'auto';

    const ctx = this._attachedContext || gatherContext();
    this._addMessage('user', text, ctx);
    this.container.querySelector('#context-bar').classList.add('hidden');
    this._attachedContext = null;

    if (!aiEngine.isReady) {
      this._addMessage('ai', 'Please load a LiteRT LM model first.');
      return;
    }

    if (this.aiMode === AI_MODES.AGENT) {
      await this._runAutonomousAgent(text, ctx);
      return;
    }

    const prompt = this._buildPromptForMode(text, ctx);
    await this._generateResponse(prompt, this.aiMode);
  }

  _buildPromptForMode(text, ctx) {
    const relevant = getRelevantWorkspaceContext(text, ctx);
    const workspaceContext = formatWorkspaceContext(relevant);
    const current = ctx.selection
      ? `Selected code in ${ctx.fileName} (${ctx.language}):\n\`\`\`${ctx.language}\n${ctx.selection}\n\`\`\``
      : `Current file: ${ctx.fileName} (${ctx.language}), cursor line ${ctx.cursorLine}\n\`\`\`${ctx.language}\n${ctx.fileContent || ''}\n\`\`\``;

    if (this.aiMode === AI_MODES.EDIT) {
      return `You are in Edit mode. Return concise explanation plus replacement code in a markdown code block when appropriate.

${current}

Relevant workspace context:
${workspaceContext}

User request: ${text}`;
    }

    if (this.aiMode === AI_MODES.ARCHITECT) {
      return `You are in Architect mode. Do not write code unless asked for examples. Produce a practical implementation plan, architecture notes, risks, and test strategy.

${current}

Relevant workspace context:
${workspaceContext}

User request: ${text}`;
    }

    return `You are in Ask mode. Answer read-only questions using the current file and workspace context. Do not propose file writes.

${current}

Relevant workspace context:
${workspaceContext}

User request: ${text}`;
  }

  async _sendPromptDirectly(prompt, actionType) {
    const ctx = gatherContext();
    const actionLabels = {
      explain: 'Explain',
      fix: 'Fix',
      refactor: 'Refactor',
      document: 'Document',
      tests: 'Generate Tests',
      optimize: 'Optimize',
      complete: 'Complete',
    };

    this._addActionMessage(actionLabels[actionType] || 'AI Action', ctx);

    if (!aiEngine.isReady) {
      this._addMessage('ai', 'Please load a LiteRT LM model first.');
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

      this._addApplyButtons(msgEl, fullResponse, actionType);
    } catch (err) {
      typingEl.remove();
      this._addMessage('ai', `Error: ${err.message}`);
    }
  }

  async _runAutonomousAgent(task, ctx) {
    const runId = proposalManager.createRunId();
    this.activeRunId = runId;
    this.lastAgentTask = task;
    this._addTimeline('Scanning workspace context', 'active');

    const agent = new LocalAgentFramework((event) => this._handleAgentEvent(event), { runId, task });

    try {
      await agent.runAgentLoop(task, ctx.allFiles);
      const pending = proposalManager.getPending(runId);
      if (pending.length) {
        this._addTimeline(`${pending.length} proposed change(s) ready for review`, 'success');
        this._renderProposalGroup(runId);
      } else {
        this._addTimeline('Agent finished without file proposals', 'success');
      }
    } catch (err) {
      this._addTimeline(`Agent crashed: ${err.message}`, 'error');
      this._addMessage('ai', `Agent crashed: ${err.message}`);
    }
  }

  _handleAgentEvent(event) {
    if (event.type === 'status') {
      this._addTimeline(event.message, 'active');
      return;
    }

    if (event.type === 'system') {
      this._addTimeline(event.message, 'info');
      return;
    }

    if (event.type === 'token') {
      return;
    }

    if (event.type === 'agent_fallback') {
      this._addTimeline('Tool format failed, switching to deterministic local search', 'info');
      this._runLocalAgentFallback(this.lastAgentTask || '');
      return;
    }

    if (event.type === 'tool_call') {
      this._addToolMessage('Tool call', event.tool.name, event.tool);
      return;
    }

    if (event.type === 'tool_result') {
      this._addToolMessage('Tool result', event.tool?.name || 'tool', { result: event.result });
      return;
    }

    if (event.type === 'proposal') {
      this._addTimeline(`Proposed ${event.proposal.type}: ${event.proposal.path}`, 'info');
    }
  }

  async _runLocalAgentFallback(task) {
    const symbol = this._extractLikelySymbol(task);
    if (!symbol) {
      this._addMessage('ai', 'I could not infer a symbol to search for. Try asking for an exact function, class, or variable name.');
      return;
    }

    this._addToolMessage('Local search', 'search_exact_symbol', { symbol });
    const results = searchExactSymbol(symbol, 10);
    if (!results.length) {
      this._addMessage('ai', `I could not find \`${symbol}\` in the indexed workspace files.`);
      return;
    }

    const primary = results[0];
    const snippet = getFunctionSnippet(primary.path, symbol);
    this._addToolMessage('Local result', 'search_exact_symbol', {
      files: results.map(result => ({
        path: result.path,
        matches: result.matches.slice(0, 5),
      })),
    });

    const summary = [
      `Found \`${symbol}\` in \`${primary.path}\`.`,
      '',
      primary.matches.slice(0, 5).map(match => `- Line ${match.line}: \`${match.text.trim()}\``).join('\n'),
    ].join('\n');

    this._addMessage('ai', summary);

    if (!snippet || !aiEngine.isReady) return;

    await this._generateResponse(`Explain what this function/symbol does. Be concise and mention the file path.

File: ${snippet.path}
Lines: ${snippet.startLine}-${snippet.endLine}

\`\`\`${snippet.language}
${snippet.content}
\`\`\`

Original user task: ${task}`, AI_MODES.ASK);
  }

  _extractLikelySymbol(task) {
    const codeTick = String(task || '').match(/`([^`]+)`/);
    if (codeTick) return codeTick[1].trim();

    const fnMatch = String(task || '').match(/\b([A-Za-z_][A-Za-z0-9_]*)\s+(?:function|method|symbol)\b/i);
    if (fnMatch) return fnMatch[1];

    const containsMatch = String(task || '').match(/\bcontains?\s+([A-Za-z_][A-Za-z0-9_]*)\b/i);
    if (containsMatch) return containsMatch[1];

    const words = String(task || '').match(/\b[A-Za-z_][A-Za-z0-9_]{2,}\b/g) || [];
    return words.find(word => word.includes('_')) || words.find(word => !['find', 'which', 'file', 'what', 'does', 'that', 'function', 'do'].includes(word.toLowerCase())) || '';
  }

  _handleProposalEvent(event) {
    if (!event) return;
    if (event.type === 'proposal_applied') {
      this._addTimeline(`Applied ${event.proposal.path}`, 'success');
    } else if (event.type === 'proposal_discarded') {
      this._addTimeline(`Discarded ${event.proposal.path}`, 'info');
    } else if (event.type === 'proposals_applied') {
      this._addTimeline(`Applied ${event.proposals.length} proposed change(s)`, 'success');
    } else if (event.type === 'proposals_discarded') {
      this._addTimeline(`Discarded ${event.proposals.length} proposed change(s)`, 'info');
    } else if (event.type === 'checkpoint_rolled_back') {
      this._addTimeline(`Rolled back checkpoint for ${event.checkpoint.files.length} file(s)`, 'success');
    }
  }

  _renderProposalGroup(runId) {
    const proposals = proposalManager.getPending(runId);
    if (!proposals.length) return;

    const msgContainer = this.container.querySelector('#chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `
      <div class="chat-msg__avatar chat-msg__avatar--ai">AI</div>
      <div class="chat-msg__body">
        <div class="chat-msg__name">Change Review</div>
        <div class="proposal-group">
          <div class="proposal-group__header">
            <strong>${proposals.length} proposed change(s)</strong>
            <span>Review before applying to workspace</span>
          </div>
          <div class="proposal-group__list"></div>
          <div class="chat-msg__actions">
            <button class="chat-msg__action-btn chat-msg__action-btn--apply" data-action="apply-all">Apply all</button>
            <button class="chat-msg__action-btn" data-action="discard-all">Discard all</button>
            <button class="chat-msg__action-btn chat-msg__action-btn--diff" data-action="rollback">Rollback latest</button>
          </div>
        </div>
      </div>
    `;

    const list = div.querySelector('.proposal-group__list');
    proposals.forEach(proposal => list.appendChild(this._createProposalCard(proposal)));

    div.querySelector('[data-action="apply-all"]').addEventListener('click', async () => {
      await proposalManager.applyAll(runId);
      div.querySelectorAll('button').forEach(btn => btn.disabled = true);
    });
    div.querySelector('[data-action="discard-all"]').addEventListener('click', () => {
      proposalManager.discardAll(runId);
      div.querySelectorAll('button').forEach(btn => btn.disabled = true);
    });
    div.querySelector('[data-action="rollback"]').addEventListener('click', async () => {
      await proposalManager.rollbackLatest();
    });

    msgContainer.appendChild(div);
    this._scrollToBottom();
  }

  _createProposalCard(proposal) {
    const stats = diffStats(proposal.before, proposal.after);
    const card = document.createElement('div');
    card.className = 'proposal-card';
    card.innerHTML = `
      <div class="proposal-card__meta">
        <span class="proposal-card__type">${proposal.type}</span>
        <code>${escapeHtml(proposal.path)}</code>
        <span class="proposal-card__stats">+${stats.added} -${stats.removed}</span>
      </div>
      <details>
        <summary>Preview diff</summary>
        ${renderDiffHTML(computeDiff(proposal.before, proposal.after))}
      </details>
      <div class="chat-msg__actions">
        <button class="chat-msg__action-btn chat-msg__action-btn--apply" data-action="apply">Apply</button>
        <button class="chat-msg__action-btn" data-action="discard">Discard</button>
      </div>
    `;

    card.querySelector('[data-action="apply"]').addEventListener('click', async () => {
      await proposalManager.applyProposal(proposal.id);
      card.classList.add('proposal-card--applied');
      card.querySelectorAll('button').forEach(btn => btn.disabled = true);
    });
    card.querySelector('[data-action="discard"]').addEventListener('click', () => {
      proposalManager.discardProposal(proposal.id);
      card.classList.add('proposal-card--discarded');
      card.querySelectorAll('button').forEach(btn => btn.disabled = true);
    });

    return card;
  }

  _addApplyButtons(msgEl, response, actionType) {
    if (!APPLY_ACTIONS.has(actionType)) return;

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
      const applyBtn = document.createElement('button');
      applyBtn.className = 'chat-msg__action-btn chat-msg__action-btn--apply';
      applyBtn.textContent = `Apply${blocks.length > 1 ? ` Block ${i + 1}` : ''}`;
      applyBtn.addEventListener('click', () => {
        this._applyCode(block.code, actionType);
        applyBtn.textContent = 'Applied';
        applyBtn.disabled = true;
      });
      actionsDiv.appendChild(applyBtn);

      const diffBtn = document.createElement('button');
      diffBtn.className = 'chat-msg__action-btn chat-msg__action-btn--diff';
      diffBtn.textContent = 'Diff';
      diffBtn.addEventListener('click', () => this._showDiff(block.code));
      actionsDiv.appendChild(diffBtn);

      const copyBtn = document.createElement('button');
      copyBtn.className = 'chat-msg__action-btn';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(block.code);
        copyBtn.textContent = 'Copied';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
      });
      actionsDiv.appendChild(copyBtn);
    });

    msgEl.querySelector('.chat-msg__body').appendChild(actionsDiv);
  }

  _applyCode(code, actionType) {
    const view = editorContext.getView();
    if (!view) return;

    const state = view.state;
    const sel = state.selection.main;
    if (sel.from !== sel.to && ['fix', 'refactor', 'document', 'optimize', AI_MODES.EDIT].includes(actionType)) {
      view.dispatch({ changes: { from: sel.from, to: sel.to, insert: code } });
    } else {
      view.dispatch({ changes: { from: 0, to: state.doc.length, insert: code } });
    }
  }

  _showDiff(newCode) {
    const ctx = gatherContext();
    const original = ctx.selection || ctx.fileContent;
    this._addRawMessage('ai', `<div class="chat-msg__diff-header">Proposed Changes</div>${renderDiffHTML(computeDiff(original, newCode))}`);
  }

  _addMessage(role, text, context) {
    const msgContainer = this.container.querySelector('#chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    const isUser = role === 'user';
    const contextBadge = isUser && context?.fileName
      ? `<span class="chat-msg__context-badge">${escapeHtml(context.fileName)}${context.selection ? ` (${context.selection.split('\n').length} selected lines)` : ''}</span>`
      : '';

    div.innerHTML = `
      <div class="chat-msg__avatar ${isUser ? 'chat-msg__avatar--user' : 'chat-msg__avatar--ai'}">
        ${isUser ? 'You' : 'AI'}
      </div>
      <div class="chat-msg__body">
        <div class="chat-msg__name">${isUser ? 'You' : `Nova ${MODE_LABELS[this.aiMode]}`}</div>
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
      <div class="chat-msg__avatar chat-msg__avatar--user">You</div>
      <div class="chat-msg__body">
        <div class="chat-msg__name">You</div>
        <div class="chat-msg__action-tag">${escapeHtml(label)}</div>
        <span class="chat-msg__context-badge">${escapeHtml(ctx.fileName)} - ${ctx.selection ? `${ctx.selection.split('\n').length} selected lines` : 'current file'}</span>
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
      <div class="chat-msg__avatar chat-msg__avatar--ai">AI</div>
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
      <div class="chat-msg__avatar chat-msg__avatar--ai">AI</div>
      <div class="chat-msg__body">
        <div class="chat-msg__name">Nova ${MODE_LABELS[this.aiMode]}</div>
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

  _addTimeline(message, state = 'info') {
    this._addRawMessage('ai', `<div class="agent-timeline agent-timeline--${state}"><span></span>${escapeHtml(message)}</div>`);
  }

  _addToolMessage(label, name, payload) {
    const safePayload = escapeHtml(JSON.stringify(payload, null, 2)).slice(0, 3000);
    this._addRawMessage('ai', `
      <details class="agent-tool">
        <summary>${escapeHtml(label)}: <code>${escapeHtml(name)}</code></summary>
        <pre>${safePayload}</pre>
      </details>
    `);
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
    const isLoading = [MODEL_STATUS.DOWNLOADING, MODEL_STATUS.LOADING].includes(aiEngine.status);
    this.container.querySelectorAll('.model-status__btn--primary').forEach(btn => {
      btn.disabled = isLoading;
    });
  }

  _formatMarkdown(text) {
    if (!text) return '';
    return escapeHtml(text)
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="code-block"><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }
}
