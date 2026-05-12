/**
 * ai-engine.js — Local AI Inference wrapper
 * Uses @mediapipe/tasks-genai for on-device WebGPU inference.
 */

const MODEL_STATUS = {
  IDLE: 'idle',
  DOWNLOADING: 'downloading',
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error',
  GENERATING: 'generating',
};

class AIEngine {
  constructor() {
    this.llmInference = null;
    this.status = MODEL_STATUS.IDLE;
    this.statusMessage = 'No model loaded';
    this.listeners = new Set();
    this.modelName = 'Local AI Engine';
  }

  /** Subscribe to status changes */
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

  /**
   * Load model from a URL or user-uploaded file.
   * @param {string|File} modelSource - URL string or File object
   */
  async loadModel(modelSource) {
    try {
      this._setStatus(MODEL_STATUS.LOADING, 'Importing AI Engine…');

      // Dynamic import so initial page load is fast
      const genai = await import('@mediapipe/tasks-genai');
      const { FilesetResolver, LlmInference } = genai;

      this._setStatus(MODEL_STATUS.LOADING, 'Loading AI runtime…');

      // Initialize the WASM fileset resolver (required by MediaPipe)
      const genaiFileset = await FilesetResolver.forGenAiTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@latest/wasm'
      );

      this._setStatus(MODEL_STATUS.LOADING, 'Initializing LLM engine…');

      let modelAssetPath = null;
      let modelAssetBuffer = null;

      if (typeof modelSource === 'string') {
        modelAssetPath = modelSource;
        this._setStatus(MODEL_STATUS.DOWNLOADING, 'Downloading model…');
      } else if (modelSource instanceof File) {
        this._setStatus(MODEL_STATUS.LOADING, 'Reading model file…');
        const buf = await modelSource.arrayBuffer();
        modelAssetBuffer = new Uint8Array(buf);
      }

      this._setStatus(MODEL_STATUS.LOADING, 'Compiling model for WebGPU…');

      const options = {
        baseOptions: {},
        maxTokens: 2048,
        topK: 40,
        temperature: 0.7,
        randomSeed: 42,
      };

      if (modelAssetPath) {
        options.baseOptions.modelAssetPath = modelAssetPath;
      }
      if (modelAssetBuffer) {
        options.baseOptions.modelAssetBuffer = modelAssetBuffer;
      }

      // FilesetResolver must be passed as the first argument
      this.llmInference = await LlmInference.createFromOptions(genaiFileset, options);
      this._setStatus(MODEL_STATUS.READY, 'Model ready — on-device inference active');
    } catch (err) {
      console.error('[AIEngine] Load error:', err);
      this._setStatus(MODEL_STATUS.ERROR, `Failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Generate a response (streaming).
   * @param {string} prompt
   * @param {(partial: string) => void} onToken - called with each partial result
   * @returns {Promise<string>} full response
   */
  async generate(prompt, onToken) {
    if (!this.llmInference) {
      throw new Error('Model not loaded');
    }

    this._setStatus(MODEL_STATUS.GENERATING, 'Generating…');

    try {
      // Format as instruction-tuned prompt
      const formattedPrompt = this._formatPrompt(prompt);

      let fullResponse = '';

      // Use streaming API
      const response = await this.llmInference.generateResponse(
        formattedPrompt,
        (partialResult, done) => {
          fullResponse = partialResult;
          if (onToken) onToken(partialResult);
        }
      );

      // If streaming callback didn't fire, use direct result
      if (!fullResponse && response) {
        fullResponse = response;
        if (onToken) onToken(response);
      }

      this._setStatus(MODEL_STATUS.READY, 'Model ready — on-device inference active');
      return fullResponse;
    } catch (err) {
      console.error('[AIEngine] Generation error:', err);
      this._setStatus(MODEL_STATUS.READY, 'Generation completed with errors');
      throw err;
    }
  }

  /**
   * Format prompt using instruction template.
   */
  _formatPrompt(userMessage) {
    return `<start_of_turn>user
You are an expert coding assistant inside an IDE. Provide concise, correct code and explanations. Use markdown code blocks for code snippets.

${userMessage}<end_of_turn>
<start_of_turn>model
`;
  }

  get isReady() {
    return this.status === MODEL_STATUS.READY;
  }

  get isGenerating() {
    return this.status === MODEL_STATUS.GENERATING;
  }

  dispose() {
    if (this.llmInference) {
      this.llmInference.close();
      this.llmInference = null;
    }
    this._setStatus(MODEL_STATUS.IDLE, 'Engine disposed');
  }
}

// Singleton
export const aiEngine = new AIEngine();
export { MODEL_STATUS };
