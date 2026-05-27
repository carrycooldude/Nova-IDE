import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // Allow serving large LiteRT LM model files from public/
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
    // Increase timeout for large model file fetches
    hmr: {
      timeout: 60000,
    },
  },
  // Exclude model files from being processed by Vite's pipeline.
  assetsInclude: ['**/*.litertlm'],
  optimizeDeps: {
    exclude: ['@litert-lm/core'],
  },
});
