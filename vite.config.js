import { defineConfig } from 'vite';

export default defineConfig({
  // Allow serving the large .task model file from public/
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
  // Exclude model files from being processed by Vite's pipeline
  assetsInclude: ['**/*.task'],
  optimizeDeps: {
    exclude: ['@mediapipe/tasks-genai'],
  },
});
