/**
 * chat.js — AI Chat panel logic.
 */
import { aiEngine, MODEL_STATUS } from './ai-engine.js';

export class ChatPanel {
  constructor(container) {
    this.container = container;
    this.messages = [];
    this.render();
    this._bindEvents();
    this._updateModelStatus();

    // Listen for status changes
    aiEngine.onStatusChange(() => this._updateModelStatus());
  }

  render() {
    this.container.innerHTML = `
      <div class="ai-panel__header">
        <div class="ai-panel__header-icon">✦</div>
        <span class="ai-panel__header-title">Nova AI</span>
        <span class="ai-panel__header-badge">On-Device</span>
        <div class="ai-panel__header-spacer"></div>
        <button class="ai-panel__header-btn" id="ai-clear-btn" title="Clear chat">🗑</button>
      </div>

      <div class="ai-panel__model-status" id="model-status-area">
        <div class="model-status__row">
          <div class="model-status__dot model-status__dot--idle" id="model-dot"></div>
          <span class="model-status__label" id="model-status-text">No model loaded</span>
        </div>
        <div class="model-status__row" style="margin-top: 4px;">
          <button class="model-status__btn model-status__btn--primary" id="model-quickload-btn"
            style="width: 100%; padding: 8px 14px; font-size: 13px;">
            ⚡ Load Local AI Model
          </button>
        </div>
        <div class="model-status__row" style="justify-content: center;">
          <span class="model-status__label" style="font-size: 10px; color: var(--text-muted);">
            local-model.task — served from /models/
          </span>
        </div>
        <div class="model-status__progress hidden" id="model-progress">
          <div class="model-status__progress-bar" id="model-progress-bar" style="width: 0%"></div>
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
              Welcome! I'm your <strong>Local AI Assistant</strong> running entirely on your device.<br><br>
              Load the model to get started, then ask me anything about your code. 
              Your data stays private — no cloud required. ✨
            </div>
          </div>
        </div>
      </div>

      <div class="ai-panel__input-area">
        <div class="chat-input">
          <textarea class="chat-input__textarea" id="chat-textarea" 
            placeholder="Ask AI about your code…" rows="1"></textarea>
          <button class="chat-input__send" id="chat-send-btn" title="Send (Enter)">➤</button>
        </div>
      </div>
    `;
  }

  _bindEvents() {
    // Quick-load bundled model
    const quickloadBtn = this.container.querySelector('#model-quickload-btn');
    quickloadBtn.addEventListener('click', async () => {
      try {
        await aiEngine.loadModel('/models/gemma-4-E2B-it-web.task');
      } catch (err) {
        this._addMessage('ai', `❌ Failed to load local model: ${err.message}`);
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
      this._addMessage('ai', 'Chat cleared. Ask me anything about your code!');
    });
  }

  async _sendMessage() {
    const textarea = this.container.querySelector('#chat-textarea');
    const text = textarea.value.trim();
    if (!text) return;

    textarea.value = '';
    textarea.style.height = 'auto';

    // Add user message
    this._addMessage('user', text);

    if (!aiEngine.isReady) {
      this._addMessage('ai', '⚠️ Please load a model first using the panel above.');
      return;
    }

    // Show typing indicator
    const typingEl = this._addTypingIndicator();

    try {
      const msgEl = this._addMessage('ai', '');
      const textEl = msgEl.querySelector('.chat-msg__text');

      // Remove typing indicator
      typingEl.remove();

      await aiEngine.generate(text, (partial) => {
        textEl.innerHTML = this._formatMarkdown(partial);
        this._scrollToBottom();
      });
    } catch (err) {
      typingEl.remove();
      this._addMessage('ai', `❌ Error: ${err.message}`);
    }
  }

  _addMessage(role, text) {
    const msgContainer = this.container.querySelector('#chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg';

    const isUser = role === 'user';
    div.innerHTML = `
      <div class="chat-msg__avatar ${isUser ? 'chat-msg__avatar--user' : 'chat-msg__avatar--ai'}">
        ${isUser ? '👤' : '✦'}
      </div>
      <div class="chat-msg__body">
        <div class="chat-msg__name">${isUser ? 'You' : 'AI Assistant'}</div>
        <div class="chat-msg__text">${this._formatMarkdown(text)}</div>
      </div>
    `;

    msgContainer.appendChild(div);
    this._scrollToBottom();
    return div;
  }

  _addTypingIndicator() {
    const msgContainer = this.container.querySelector('#chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `
      <div class="chat-msg__avatar chat-msg__avatar--ai">✦</div>
      <div class="chat-msg__body">
        <div class="chat-msg__name">AI Assistant</div>
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

    // Remove old dot classes
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

    // Disable upload buttons during loading
    const btns = this.container.querySelectorAll('.model-status__btn--primary');
    const isLoading = [MODEL_STATUS.DOWNLOADING, MODEL_STATUS.LOADING].includes(aiEngine.status);
    btns.forEach(btn => btn.disabled = isLoading);
  }

  _formatMarkdown(text) {
    if (!text) return '';
    // Basic markdown: code blocks, inline code, bold, newlines
    return text
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }
}
