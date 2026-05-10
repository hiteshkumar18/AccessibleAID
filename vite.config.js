import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  // Let Vite pre-bundle transformers.js so it is served as proper ESM.
  // Without pre-bundling, Vite serves the raw webpack/CJS bundle directly —
  // browsers cannot dynamic-import() a CJS file, so the import silently fails
  // and every AI feature appears to do nothing.
  //
  // onnxruntime-web is excluded because it ships raw .wasm binaries that esbuild
  // cannot bundle; it is already inlined inside the transformers.js webpack bundle
  // so it never needs to be imported separately.
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
  // Treat .wasm as plain assets so Vite copies them to dist/ untouched.
  assetsInclude: ['**/*.wasm'],
  build: {
    target: 'esnext',
    assetsInlineLimit: 0,
  },
});
