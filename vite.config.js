import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  // transformers.js v3 ships as native ESM — Vite must NOT pre-bundle it.
  // When esbuild rewrites the package it corrupts the internal URL resolution
  // that transformers.js uses to fetch model shards from the HuggingFace Hub.
  // The broken URLs resolve back to the Vite dev server, which serves the
  // SPA's index.html catch-all — causing the "received app HTML instead of
  // model JSON" error seen in Scene Camera and other AI features.
  //
  // onnxruntime-web is excluded for the same reason: it ships .wasm binaries
  // that esbuild cannot process and it is already inlined inside the
  // transformers.js bundle.
  optimizeDeps: {
    exclude: ['@huggingface/transformers', 'onnxruntime-web'],
  },
  server: {
    proxy: {
      // Forward every /api/* request from the browser to the Python AI backend
      // running on port 8000 (backend/main.py).
      '/api': {
        target:       'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  // Treat .wasm as plain assets so Vite copies them to dist/ untouched.
  assetsInclude: ['**/*.wasm'],
  build: {
    target: 'esnext',
    assetsInlineLimit: 0,
  },
});
