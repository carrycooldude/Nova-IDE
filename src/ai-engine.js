/**
 * ai-engine.js - Local AI inference wrapper.
 * Uses LiteRT LM for on-device WebGPU inference.
 */

const MODEL_STATUS = {
  IDLE: 'idle',
  DOWNLOADING: 'downloading',
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error',
  GENERATING: 'generating',
};

const SYSTEM_PROMPT = 'You are an expert coding assistant inside an IDE. Provide concise, correct code and explanations. Use markdown code blocks for code snippets.';
const MIN_MODEL_BYTES = 1024 * 1024;

class AIEngine {
  constructor() {
    this.engine = null;
    this.conversation = null;
    this.status = MODEL_STATUS.IDLE;
    this.statusMessage = 'No model loaded';
    this.listeners = new Set();
    this.modelName = 'LiteRT LM';
    this._opfsRoot = null;
  }

  async _getOpfs() {
    if (!this._opfsRoot) {
      this._opfsRoot = await navigator.storage.getDirectory();
    }
    return this._opfsRoot;
  }

  /** Check if a model exists in OPFS cache. */
  async getCachedModel(filename) {
    try {
      const root = await this._getOpfs();
      const fileHandle = await root.getFileHandle(filename);
      const file = await fileHandle.getFile();
      if (file.size < MIN_MODEL_BYTES) {
        await root.removeEntry(filename);
        return null;
      }
      return file;
    } catch (e) {
      return null;
    }
  }

  /** Save a buffer to OPFS cache. */
  async saveToCache(filename, buffer) {
    try {
      const root = await this._getOpfs();
      const fileHandle = await root.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(buffer);
      await writable.close();
      console.log(`[AIEngine] Saved ${filename} to OPFS cache`);
    } catch (err) {
      console.error('[AIEngine] OPFS save error:', err);
    }
  }

  /** Stream a response body directly into OPFS without buffering the model in RAM. */
  async saveResponseToCache(filename, response, onProgress) {
    const root = await this._getOpfs();
    const fileHandle = await root.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    const reader = response.body.getReader();
    const total = parseInt(response.headers.get('content-length') || '0');
    let received = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        await writable.write(value);
        received += value.length;

        if (onProgress) onProgress(received, total);
        this._setStatus(
          MODEL_STATUS.DOWNLOADING,
          total
            ? `Downloading... ${(received / 1048576).toFixed(0)} / ${(total / 1048576).toFixed(0)} MB`
            : `Downloading... ${(received / 1048576).toFixed(0)} MB`
        );
      }
    } catch (err) {
      await writable.abort();
      await this.deleteFromCache(filename);
      throw err;
    }

    await writable.close();
    const file = await fileHandle.getFile();
    if (file.size < MIN_MODEL_BYTES || (total > 0 && file.size !== total)) {
      await this.deleteFromCache(filename);
      throw new Error(
        total > 0
          ? `Downloaded model is incomplete (${file.size} of ${total} bytes). Please retry.`
          : 'Downloaded model is incomplete. Please retry.'
      );
    }
    return file;
  }

  /** Delete a model from OPFS cache. */
  async deleteFromCache(filename) {
    try {
      const root = await this._getOpfs();
      await root.removeEntry(filename);
    } catch (e) {}
  }

  /** Subscribe to status changes. */
  onStatusChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit() {
    const info = {
      status: this.status,
      message: this.statusMessage,
      modelName: this.modelName,
    };
    this.listeners.forEach(fn => fn(info));
  }

  _setStatus(status, message) {
    this.status = status;
    this.statusMessage = message;
    this._emit();
  }

  async _deleteConversation() {
    if (this.conversation) {
      await this.conversation.delete();
      this.conversation = null;
    }
  }

  async _deleteEngine() {
    await this._deleteConversation();
    if (this.engine) {
      await this.engine.delete();
      this.engine = null;
    }
  }

  async _createConversation() {
    if (!this.engine) {
      throw new Error('Model not loaded');
    }

    return this.engine.createConversation({
      sessionConfig: {
        samplerParams: {
          k: 40,
          temperature: 0.7,
          seed: 42,
        },
        maxOutputTokens: 8192,
      },
      preface: {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
        ],
      },
    });
  }

  /**
   * Load model from a URL, OPFS File, or user-uploaded file.
   * @param {string|File} modelSource - URL string or File object
   */
  async loadModel(modelSource) {
    try {
      this._setStatus(MODEL_STATUS.LOADING, 'Importing LiteRT LM...');

      const { Engine } = await import('@litert-lm/core');

      await this._deleteEngine();

      let model = modelSource;
      if (modelSource instanceof File) {
        this._setStatus(MODEL_STATUS.LOADING, 'Reading LiteRT LM model file...');
        model = modelSource.stream();
      } else if (typeof modelSource === 'string') {
        this._setStatus(MODEL_STATUS.DOWNLOADING, 'Preparing model download...');
      }

      this._setStatus(MODEL_STATUS.LOADING, 'Initializing LiteRT LM engine...');

      this.engine = await Engine.create({
        model,
        mainExecutorSettings: {
          maxNumTokens: 8192,
        },
      });

      this.conversation = await this._createConversation();
      this._setStatus(MODEL_STATUS.READY, 'Model ready - LiteRT LM on-device inference active');
    } catch (err) {
      console.error('[AIEngine] Load error:', err);
      this._setStatus(MODEL_STATUS.ERROR, `Failed: ${err.message}`);
      throw err;
    }
  }

  _chunkText(chunk) {
    if (!chunk) return '';
    if (typeof chunk.content === 'string') return chunk.content;
    if (!Array.isArray(chunk.content)) return '';

    return chunk.content
      .filter(item => item && item.type === 'text' && typeof item.text === 'string')
      .map(item => item.text)
      .join('');
  }

  async _streamMessage(conversation, message, onToken) {
    let fullResponse = '';
    const stream = conversation.sendMessageStreaming(message);

    for await (const chunk of stream) {
      const text = this._chunkText(chunk);
      if (!text) continue;
      fullResponse += text;
      if (onToken) onToken(fullResponse);
    }

    return fullResponse;
  }

  _messagesFromGemmaTranscript(rawPrompt) {
    const turnRegex = /<start_of_turn>(user|model)\n([\s\S]*?)(?:<end_of_turn>|$)/g;
    const messages = [];
    let match;

    while ((match = turnRegex.exec(rawPrompt)) !== null) {
      const role = match[1] === 'model' ? 'assistant' : 'user';
      const content = match[2].trim();
      if (!content) continue;
      messages.push({ role, content });
    }

    return messages.length ? messages : rawPrompt;
  }

  /**
   * Generate a response in the main chat conversation.
   * @param {string} prompt
   * @param {(partial: string) => void} onToken - called with accumulated text
   * @returns {Promise<string>} full response
   */
  async generate(prompt, onToken) {
    if (!this.conversation) {
      throw new Error('Model not loaded');
    }

    this._setStatus(MODEL_STATUS.GENERATING, 'Generating...');

    try {
      const fullResponse = await this._streamMessage(this.conversation, prompt, onToken);
      this._setStatus(MODEL_STATUS.READY, 'Model ready - LiteRT LM on-device inference active');
      return fullResponse;
    } catch (err) {
      console.error('[AIEngine] Generation error:', err);
      this._setStatus(MODEL_STATUS.READY, 'Generation completed with errors');
      throw err;
    }
  }

  /**
   * Generate a response using a raw formatted string for the agent loop.
   */
  async generateRaw(rawPrompt, onToken) {
    if (!this.engine) {
      throw new Error('Model not loaded');
    }

    this._setStatus(MODEL_STATUS.GENERATING, 'Agent thinking...');

    let conversation = null;
    try {
      conversation = await this._createConversation();
      const message = this._messagesFromGemmaTranscript(rawPrompt);
      const fullResponse = await this._streamMessage(conversation, message, onToken);
      this._setStatus(MODEL_STATUS.READY, 'Model ready - LiteRT LM on-device inference active');
      return fullResponse;
    } catch (err) {
      console.error('[AIEngine] Raw generation error:', err);
      this._setStatus(MODEL_STATUS.READY, 'Generation completed with errors');
      throw err;
    } finally {
      if (conversation) {
        await conversation.delete();
      }
    }
  }

  get isReady() {
    return this.status === MODEL_STATUS.READY;
  }

  get isGenerating() {
    return this.status === MODEL_STATUS.GENERATING;
  }

  /**
   * Download a model from a URL with progress tracking, then load it.
   * @param {string} url - Direct download URL
   * @param {boolean} persist - Whether to save to OPFS
   * @param {(received: number, total: number) => void} onProgress
   */
  async downloadAndLoad(url, persist, onProgress) {
    try {
      const filename = url.split('/').pop();

      if (persist) {
        const cached = await this.getCachedModel(filename);
        if (cached) {
          this._setStatus(MODEL_STATUS.LOADING, 'Loading from local disk...');
          try {
            await this.loadModel(cached);
            return;
          } catch (err) {
            await this.deleteFromCache(filename);
            console.warn('[AIEngine] Removed corrupt cached model:', err);
            this._setStatus(MODEL_STATUS.DOWNLOADING, 'Cached model was corrupt. Downloading again...');
          }
        }
      }

      this._setStatus(MODEL_STATUS.DOWNLOADING, 'Connecting...');

      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);

      const total = parseInt(response.headers.get('content-length') || '0');

      if (persist) {
        const file = await this.saveResponseToCache(filename, response, onProgress);
        await this.loadModel(file);
        return;
      }

      if (total > 1024 * 1024 * 1024) {
        throw new Error('This model is too large for memory-only loading. Enable "Save to local disk (OPFS)" and try again.');
      }

      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (onProgress) onProgress(received, total);
        this._setStatus(
          MODEL_STATUS.DOWNLOADING,
          total
            ? `Downloading... ${(received / 1048576).toFixed(0)} / ${(total / 1048576).toFixed(0)} MB`
            : `Downloading... ${(received / 1048576).toFixed(0)} MB`
        );
      }

      const buffer = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.length;
      }

      const file = new File([buffer], filename);

      await this.loadModel(file);
    } catch (err) {
      console.error('[AIEngine] Download error:', err);
      this._setStatus(MODEL_STATUS.ERROR, `Download failed: ${err.message}`);
      throw err;
    }
  }

  async dispose() {
    await this._deleteEngine();
    this._setStatus(MODEL_STATUS.IDLE, 'Engine disposed');
  }
}

// Singleton
export const aiEngine = new AIEngine();
export { MODEL_STATUS };
