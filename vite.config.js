import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// transformers.js v3 ships ESM workers and uses onnxruntime-web. We need to
// make sure Vite does not try to pre-bundle the WASM/ONNX backends.
export default defineConfig({
  plugins: [react()],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['@huggingface/transformers', 'onnxruntime-web'],
  },
  // NOTE: We deliberately do NOT set Cross-Origin-Opener-Policy or
  // Cross-Origin-Embedder-Policy here. They enable SharedArrayBuffer (used
  // by ORT-WASM multithreading) but in practice they also block large model
  // fetches from the Hugging Face CDN on some Chrome builds — the request
  // starts, headers return, and the body silently never streams. Single-
  // threaded WASM is plenty fast for the small models we use.
  build: {
    target: 'esnext',
  },
});
