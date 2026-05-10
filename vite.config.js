import { defineConfig }   from 'vite';
import react              from '@vitejs/plugin-react';
import { readFileSync }   from 'fs';
import { join, dirname }  from 'path';
import { fileURLToPath }  from 'url';
import { execFileSync }   from 'child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir }         from 'os';

// ── Text simplification ───────────────────────────────────────────────────────
// Priority order:
//   1. Claude API  (if ANTHROPIC_API_KEY is set in the shell env — best quality)
//   2. Ollama      (if running locally at localhost:11434 — good quality, offline)
//   3. Rule-based  (jargon substitution + sentence splitting — always available)

const SIMPLIFY_PROMPT =
  'Rewrite the following text so it is easy to understand. ' +
  'Use short sentences and simple, everyday words. ' +
  'Keep every important fact. ' +
  'Output ONLY the rewritten text — no intro, no explanation.\n\n';

async function simplifyViaClaude(text, apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: SIMPLIFY_PROMPT + text }],
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}`);
  const data = await res.json();
  const out = data.content?.[0]?.text?.trim();
  if (!out) throw new Error('Empty Claude response');
  return out;
}

async function simplifyViaOllama(text) {
  // Try whichever model Ollama has available (smallest first).
  const models = ['llama3.2:1b', 'llama3.2', 'llama3', 'mistral', 'phi3'];
  // First find what's installed.
  const listRes = await fetch('http://localhost:11434/api/tags', {
    signal: AbortSignal.timeout(2_000),
  }).catch(() => null);
  if (!listRes?.ok) throw new Error('Ollama not running');
  const { models: installed = [] } = await listRes.json();
  const names = installed.map(m => m.name);
  const model = models.find(m => names.some(n => n.startsWith(m.split(':')[0]))) || names[0];
  if (!model) throw new Error('No Ollama model found');

  const res = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, prompt: SIMPLIFY_PROMPT + text, stream: false }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}`);
  const data = await res.json();
  const out = data.response?.trim();
  if (!out) throw new Error('Empty Ollama response');
  return out;
}

// Jargon word-swaps kept as last-resort fallback.
const SWAPS = [
  [/\bone\s*\(1\)/gi,'1'],[/\btwo\s*\(2\)/gi,'2'],[/\bthree\s*\(3\)/gi,'3'],
  [/\bfour\s*\(4\)/gi,'4'],[/\bfive\s*\(5\)/gi,'5'],[/\bsix\s*\(6\)/gi,'6'],
  [/\bseven\s*\(7\)/gi,'7'],[/\beight\s*\(8\)/gi,'8'],[/\bnine\s*\(9\)/gi,'9'],
  [/\bten\s*\(10\)/gi,'10'],
  [/\bconcomitant administration with\b/gi,'taking at the same time as'],
  [/\bconcomitant(ly)?\b/gi,'at the same time'],
  [/\badministration\b/gi,'use'],[/\badminister(ed)?\b/gi,'take'],
  [/\banticoagulants?\b/gi,'blood thinners'],[/\bpotentiate\b/gi,'increase'],
  [/\bhealthcare provider\b/gi,'doctor or nurse'],
  [/\bdiscontinue\b/gi,'stop using'],
  [/\bcontraindicated\b/gi,'should not be used'],
  [/\badverse (effects?|reactions?)\b/gi,'side effects'],
  [/\bhypersensitivity\b/gi,'allergic reaction'],
  [/\brenal\b/gi,'kidney'],[/\bhepatic\b/gi,'liver'],
  [/\bcardiac\b/gi,'heart'],[/\bpulmonary\b/gi,'lung'],
  [/\bgastrointestinal\b/gi,'stomach'],[/\bdosage\b/gi,'dose'],
  [/\bphysician\b/gi,'doctor'],[/\bpractitioner\b/gi,'doctor'],
  [/\bexceed(ing)?\b/gi,'go over'],[/\bpersist(s|ing)?\b/gi,'continue'],
  [/\bconsult\b/gi,'talk to'],[/\boral(ly)?\b/gi,'by mouth'],
  [/\bherein\b/gi,'in this'],[/\bthereof\b/gi,'of that'],
  [/\bpursuant to\b/gi,'under'],[/\bnotwithstanding\b/gi,'despite'],
  [/\bshall\b/gi,'must'],[/\bterminate\b/gi,'end'],
  [/\bcomply with\b/gi,'follow'],[/\bprior to\b/gi,'before'],
  [/\bsubsequent to\b/gi,'after'],[/\bcommence(ment)?\b/gi,'start'],
  [/\bin the event that\b/gi,'if'],[/\bprovided that\b/gi,'as long as'],
  [/\butilize\b/gi,'use'],[/\bfacilitate\b/gi,'help'],
  [/\bascertain\b/gi,'find out'],[/\bdemonstrate\b/gi,'show'],
  [/\bobtain\b/gi,'get'],[/\brequire\b/gi,'need'],
  [/\bsufficient\b/gi,'enough'],[/\bimmediately\b/gi,'right away'],
  [/\bapproximately\b/gi,'about'],[/\badditionally\b/gi,'also'],
  [/\bfurthermore\b/gi,'also'],[/\bhowever\b/gi,'but'],
  [/\btherefore\b/gi,'so'],[/\bin order to\b/gi,'to'],
  [/\bfor the purpose of\b/gi,'to'],[/\bpertaining to\b/gi,'about'],
  [/\bevaluate\b/gi,'check'],[/\breliability\b/gi,'how well it works'],
  [/\bcriteria\b/gi,'requirements'],[/\bcriterion\b/gi,'requirement'],
  [/\bdiagnosis\b/gi,'finding'],[/\banalysis\b/gi,'study'],
];

function ruleBasedSimplify(text) {
  let out = text.trim();
  for (const [p, r] of SWAPS) out = out.replace(p, r);
  // Split run-ons at transitional pivots with no preceding period
  out = out.replace(/([a-z])\s+(this\s+(?:serves|acts|works|is used|provides|allows))/gi,
    (_, ch, pivot) => `${ch}. ${pivot.charAt(0).toUpperCase()}${pivot.slice(1)}`);
  out = out.replace(/\s*;\s*/g, '. ');
  out = out.replace(/,\s+which\s+/gi, '. It ');
  out = out.replace(/\bwhereas\b/gi, '. ');
  out = out.replace(/\.{2,}/g, '.').replace(/\s{2,}/g, ' ');
  out = out.replace(/(^|[.!?]\s+)([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
  return out.trim();
}

async function simplifyText(text) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try { return await simplifyViaClaude(text, apiKey); } catch (_) {}
  }
  try { return await simplifyViaOllama(text); } catch (_) {}
  return ruleBasedSimplify(text);
}

const __dirname = dirname(fileURLToPath(import.meta.url));

const OCR_SCRIPT = join(__dirname, 'scripts/macos-ocr.swift');

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

export default defineConfig({
  plugins: [
    react(),

    // Serve ort-wasm-simd-threaded.jsep.mjs from node_modules.
    // Files in public/ cannot be dynamically import()ed in Vite dev mode,
    // so we intercept the request before Vite's asset pipeline sees it.
    {
      name: 'ort-jsep-module',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (!req.url?.startsWith('/ort-wasm-simd-threaded.jsep.mjs')) return next();
          try {
            const src = readFileSync(
              join(__dirname, 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs'),
              'utf-8',
            );
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.end(src);
          } catch { next(); }
        });
      },
    },

    // Text simplification — POST /api/infer/summarize
    // Body: { text, max_new_tokens?, min_length? }
    // Returns: { text: "<simplified>" }
    {
      name: 'infer-summarize',
      configureServer(server) {
        server.middlewares.use('/api/infer/summarize', async (req, res, next) => {
          if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.statusCode = 204;
            return res.end();
          }
          if (req.method !== 'POST') return next();

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');

          try {
            const raw  = await readBody(req);
            const body = JSON.parse(raw);
            const text = (body.text || '').trim();
            if (!text) {
              return res.end(JSON.stringify({ text: '' }));
            }
            const summary = await simplifyText(text);
            res.end(JSON.stringify({ text: summary }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err?.message || 'Summarize failed' }));
          }
        });
      },
    },

    // macOS Vision OCR endpoint — POST /api/macos-ocr
    // Body: { image: "data:image/jpeg;base64,..." }
    // Returns: { text: "..." }
    {
      name: 'macos-vision-ocr',
      configureServer(server) {
        server.middlewares.use('/api/macos-ocr', async (req, res, next) => {
          if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.statusCode = 204;
            return res.end();
          }
          if (req.method !== 'POST') return next();

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');

          let tmpDir;
          try {
            const raw  = await readBody(req);
            const body = JSON.parse(raw);
            const dataUrl = body.image || '';
            const comma   = dataUrl.indexOf(',');
            const b64     = comma !== -1 ? dataUrl.slice(comma + 1) : dataUrl;
            const ext     = dataUrl.startsWith('data:image/png') ? '.png' : '.jpg';

            tmpDir = mkdtempSync(join(tmpdir(), 'enablecare-ocr-'));
            const imgPath = join(tmpDir, `img${ext}`);
            writeFileSync(imgPath, Buffer.from(b64, 'base64'));

            const out = execFileSync('swift', [OCR_SCRIPT, imgPath], {
              timeout: 20_000,
              encoding: 'utf-8',
            });

            res.end(JSON.stringify({ text: out.trim() }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err?.message || 'OCR failed' }));
          } finally {
            if (tmpDir) try { rmSync(tmpDir, { recursive: true }); } catch {}
          }
        });
      },
    },
  ],

  worker: { format: 'es' },

  optimizeDeps: {
    exclude: ['@huggingface/transformers', 'onnxruntime-web'],
  },

  assetsInclude: ['**/*.wasm'],

  build: {
    target: 'esnext',
    assetsInlineLimit: 0,
  },
});
