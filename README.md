# AccessibleAID

AccessibleAID is an on-device AI accessibility assistant that runs entirely in the browser and works fully offline after first load. Every model is **OSI-compatible open source** — Whisper (MIT) for transcription, ViT-GPT2 (Apache 2.0) for image captioning, TrOCR (MIT) for printed-text recognition, DETR (Apache 2.0) for object detection, Depth-Anything-v2 (Apache 2.0) for depth estimation, MiniLM (Apache 2.0) for embeddings/RAG, AST (BSD) for sound classification, and Qwen2.5-1.5B (Apache 2.0) for plain-language rewriting — packaged into a single mobile-first PWA designed with disabled users in mind. Camera frames, microphone audio, and pasted documents never leave the device. Three first-class modes work together: a Sight Assistant (scene description, spatial "what's around me" with clock positions and distance, OCR, and medication identification via local RAG), a Caption Companion (real on-device Whisper captions, smart sound classification with vibration alerts for doorbells/alarms/baby cries, and one-tap emergency phrases), and a Simplify mode (rewrites complex documents into 5th-grade English with a Flesch-Kincaid readability meter and follow-up Q&A). An always-visible Emergency SOS button, on-device voice commands, voice-only mode, full WCAG-AA accessibility, and a service worker for true offline use round it out.

## Setup

```bash
npm install
npm run dev
```

If you hit a peer-dependency conflict on first install (Vite 8 with the React plugin), run `npm install --legacy-peer-deps` — that flag is safe for hackathon use.

```bash
npm run build      # production build
npm run preview    # serve the production build (use this for the offline demo)
```

The service worker only activates in production builds (`npm run build && npm run preview`), so test the *true* offline behavior there.

## First-run instructions

1. The first time you open a mode, AccessibleAID downloads its AI models (Whisper, ViT-GPT2, TrOCR, DETR, Depth-Anything-v2, MiniLM, AST, and Llama-3.2-1B). A floating progress card in the bottom-right shows download percentages.
2. Models are cached automatically by transformers.js (IndexedDB) *and* by the service worker (Cache Storage), so subsequent loads are instant.
3. After that, every visit is instant and works offline — including with WiFi disabled.

## The offline demo (the "wow" moment)

1. Run `npm run build && npm run preview`.
2. Click into each of the four Sight tabs, both Caption sub-tools, and Simplify so all eight models cache.
3. Toggle airplane mode or disable WiFi.
4. Refresh the page. The header offline indicator updates, the service worker serves the shell from cache, the model files load instantly from IndexedDB, and every mode keeps working — including Whisper captions, depth-aware scene narration, sound classification, and plain-language rewriting.

## Standout features

- **On-device Whisper for captions and voice commands.** No more silent cloud round-trip via the Web Speech API; works in Firefox; multilingual.
- **Spatial scene narration.** DETR + Depth-Anything-v2 → "person at 11 o'clock, a step ahead; chair at 2 o'clock, across the room."
- **Smart sound alerts.** AudioSet classifier identifies doorbells, alarms, baby cries, glass breaking, and more — with haptic vibration patterns per alert type.
- **Quantified simplification.** Live Flesch-Kincaid grade-level meter shows "Reduced from grade 14 to grade 5" before/after.
- **Cross-mode memory.** OCR a pill bottle in Sight, then jump to Simplify and rewrite it into plain English with one tap.
- **Always-on Emergency SOS.** Floating red button → full-screen large-text emergency phrase + geolocation + tel:911 + 16-pulse SOS vibration.
- **Voice-only mode.** Setting that de-emphasizes visuals so blind users can run the app pocketed and rely on narration plus haptics.
- **Installable PWA.** Service worker + manifest + icons; installs on iOS/Android home screens and runs from cold start in airplane mode.

## Accessibility features

- WCAG AA contrast palette plus optional one-tap high-contrast mode (black on white).
- 48 × 48 px minimum touch targets, visible focus rings, focus-trapped modals.
- Body text 18 px, AI output 24 px; user-adjustable font scale up to 1.5×.
- Every AI result is announced through `aria-live` regions and spoken via `SpeechSynthesis`.
- Voice commands ("describe scene", "captions", "simplify") via Whisper transcribeOnce.
- Skip-to-content link, logical tab order, ARIA-labelled buttons, screen-reader-only labels on icon-only controls.
- Haptic feedback on every alert with pattern-coded distinctions (tap, success, warning, alert, SOS).
- Prefers-reduced-motion respected globally.
- First-run tutorial + "How it works" modal + persisted preferences.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend framework | React 18 + Vite |
| Styling | Tailwind CSS (custom accessibility palette) |
| State | React Context + `useReducer` |
| Image captioning | `Xenova/vit-gpt2-image-captioning` |
| Object detection | `Xenova/detr-resnet-50` |
| Depth estimation | `onnx-community/depth-anything-v2-small` |
| OCR | `Xenova/trocr-small-printed` |
| Embeddings (RAG) | `Xenova/all-MiniLM-L6-v2` |
| Speech-to-text | `Xenova/whisper-tiny.en` (true on-device) |
| Sound classification | `Xenova/ast-finetuned-audioset-10-10-0.4593` |
| Language model | `onnx-community/Qwen2.5-1.5B-Instruct` (Apache 2.0, q4) |
| RAG store | In-memory cosine similarity over hardcoded medications dataset |
| TTS | Web Speech API `SpeechSynthesis` |
| Sound monitoring | Web Audio `AnalyserNode` + AST classifier |
| Persistence | `localStorage` (preferences) + Cache Storage + IndexedDB (models) |
| PWA | manifest.webmanifest + sw.js (cache-first for models, SWR for shell) |
| Compute | WebGPU when present, WebAssembly fallback |
| Geolocation | `navigator.geolocation` for SOS |
| Haptics | `navigator.vibrate` with pattern-coded alerts |

## Project structure

```
accessibleaid/
├── package.json, vite.config.js, tailwind.config.js, postcss.config.js, index.html
├── public/
│   ├── manifest.webmanifest         (PWA manifest)
│   ├── sw.js                        (service worker — model cache + app shell)
│   ├── icon.svg, icon-192.png, icon-512.png
│   └── models/
└── src/
    ├── main.jsx, App.jsx, index.css
    ├── context/AppContext.jsx       (global state + cross-mode memory)
    ├── hooks/
    │   ├── useCamera.js, useSpeech.js, useModelLoader.js, useRAG.js, useWhisper.js
    ├── data/medications.js          (RAG knowledge base, 26 entries)
    ├── utils/
    │   ├── cosineSimilarity.js, imageUtils.js, a11y.js, haptics.js, readingLevel.js
    └── components/
        ├── layout/                  (Header, ModeSelector, LoadingOverlay)
        ├── shared/                  (CameraCapture, ResultCard, SpeakButton, OfflineBadge, EmergencySOS)
        ├── sight/                   (SightMode + SceneDescriber, SpatialNarrator, TextReader, MedIdentifier)
        ├── caption/                 (CaptionMode + LiveCaptions, EmergencyPhrases, SoundAlert)
        └── simplify/                (SimplifyMode + TextInput, SimplifiedOutput, FollowUp)
```

## Disclaimer

AccessibleAID is a hackathon prototype. It is intended as an accessibility-first proof of concept and is not a substitute for medical, legal, or professional advice.
