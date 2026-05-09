import React, { useEffect, useRef, useState } from 'react';
import { Header } from './components/layout/Header.jsx';
import { ModeSelector } from './components/layout/ModeSelector.jsx';
import { LoadingOverlay } from './components/layout/LoadingOverlay.jsx';
import { SightMode } from './components/sight/SightMode.jsx';
import { CaptionMode } from './components/caption/CaptionMode.jsx';
import { SimplifyMode } from './components/simplify/SimplifyMode.jsx';
import { EmergencySOS } from './components/shared/EmergencySOS.jsx';
import { useApp } from './context/AppContext.jsx';
import { useSpeech } from './hooks/useSpeech.js';
import { useWhisper } from './hooks/useWhisper.js';
import { announce, focusTrap } from './utils/a11y.js';

export default function App() {
  const {
    state,
    setMode,
    finishOnboarding,
    closeHow,
    closeSettings,
    updatePrefs,
  } = useApp();
  const [toast, setToast] = useState(null);

  // Toast handler (e.g. WASM-fallback notice)
  useEffect(() => {
    const handler = (ev) => {
      const detail = ev.detail || {};
      setToast({ id: Date.now(), ...detail });
      setTimeout(
        () => setToast((t) => (t && Date.now() - t.id > 4000 ? null : t)),
        4500
      );
    };
    window.addEventListener('aaid:toast', handler);
    return () => window.removeEventListener('aaid:toast', handler);
  }, []);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:bg-primary focus:text-white focus:px-3 focus:py-2 focus:rounded-lg focus:z-50"
      >
        Skip to main content
      </a>
      <Header />
      <div id="main">
        {state.mode === 'home' && (
          <>
            <HomeIntro />
            <ModeSelector />
            <VoiceCommands />
            <Disclaimer />
          </>
        )}
        {state.mode === 'sight' && <SightMode />}
        {state.mode === 'caption' && <CaptionMode />}
        {state.mode === 'simplify' && <SimplifyMode />}
      </div>

      <LoadingOverlay />
      <EmergencySOS />

      {/* aria-live region for announcements coming from a11y.announce */}
      <div className="sr-only" aria-live="polite">
        {state.announcement}
      </div>

      {state.showOnboarding && (
        <OnboardingModal onClose={finishOnboarding} setMode={setMode} />
      )}
      {state.showHowItWorks && <HowItWorksModal onClose={closeHow} />}
      {state.showSettings && (
        <SettingsModal
          onClose={closeSettings}
          prefs={state.prefs}
          updatePrefs={updatePrefs}
        />
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-20 left-1/2 -translate-x-1/2 bg-ink text-white text-sm px-4 py-2 rounded-full shadow-lg z-40"
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

function HomeIntro() {
  return (
    <section className="px-4 sm:px-6 pt-6 mx-auto max-w-2xl">
      <div className="bg-gradient-to-br from-primary/10 via-success/10 to-purple-700/10 border border-gray-200 rounded-2xl p-5">
        <h2 className="text-2xl font-bold text-ink">
          On-device AI accessibility, fully offline.
        </h2>
        <p className="mt-2 text-base text-gray-700 leading-relaxed">
          AccessibleAID runs vision, speech, and language models entirely in
          your browser. After the first load, it works with your WiFi off — so
          your camera images, microphone audio, and personal documents never
          leave your device.
        </p>
      </div>
    </section>
  );
}

/**
 * Voice commands powered by on-device Whisper. We use a one-shot
 * `transcribeOnce` recording (4 seconds) so a blind user can press the
 * button, say what they want, and be routed to the right mode — no more
 * Web Speech API roundtrip to Google.
 */
function VoiceCommands() {
  const { setMode, announce: pushAnnounce } = useApp();
  const { transcribeOnce, supported, warming } = useWhisper();
  const [busy, setBusy] = useState(false);
  const [heard, setHeard] = useState('');
  const [error, setError] = useState(null);

  const listen = async () => {
    setError(null);
    setBusy(true);
    setHeard('Listening for 4 seconds…');
    try {
      const text = (await transcribeOnce(4000)).toLowerCase();
      setHeard(text || '(silence)');
      announce(`Heard: ${text}`);
      pushAnnounce(`Heard: ${text}`);
      if (/describe|scene|see/.test(text)) {
        setMode('sight');
      } else if (/read.*text|sign|menu|ocr/.test(text)) {
        setMode('sight');
      } else if (/around|spatial|where|what.*see/.test(text)) {
        setMode('sight');
      } else if (/caption|hear|listen|live/.test(text)) {
        setMode('caption');
      } else if (/simplif|plain|easy.*read|rewrite/.test(text)) {
        setMode('simplify');
      } else if (/medication|pill|medicine|drug/.test(text)) {
        setMode('sight');
      } else if (text) {
        setError(
          'I heard you, but I couldn’t match a command. Try “describe scene”, “captions”, or “simplify”.'
        );
      }
    } catch (e) {
      setError(e?.message || 'Could not record audio.');
    } finally {
      setBusy(false);
    }
  };

  if (!supported) return null;

  return (
    <section className="px-4 sm:px-6 mx-auto max-w-2xl pb-2">
      <div className="bg-surface border border-gray-200 rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-semibold text-ink">Voice control</div>
            <p className="text-sm text-gray-600">
              On-device Whisper. Try “describe scene”, “captions”, or
              “simplify”.
            </p>
          </div>
          <button
            onClick={listen}
            disabled={busy || warming}
            className="tap-target bg-primary text-white px-4 rounded-xl font-medium disabled:opacity-50"
            aria-label="Listen for voice command"
          >
            <span aria-hidden="true">🎙</span>{' '}
            {busy
              ? 'Listening…'
              : warming
              ? 'Loading…'
              : 'Listen for command'}
          </button>
        </div>
        {(heard || error) && (
          <div className="mt-3 text-sm">
            {error ? (
              <span className="text-warning">{error}</span>
            ) : (
              <span className="text-gray-600">Heard: {heard}</span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Disclaimer() {
  return (
    <section className="px-4 sm:px-6 py-6 mx-auto max-w-2xl">
      <p className="text-xs text-gray-500 text-center">
        AccessibleAID is a hackathon prototype. It is not a substitute for
        medical, legal, or professional advice. All AI inference runs locally
        in your browser.
      </p>
    </section>
  );
}

function ModalShell({ children, onClose, label }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      focusTrap(ref.current, e);
    };
    document.addEventListener('keydown', onKey);
    setTimeout(() => {
      const first = ref.current?.querySelector(
        'button, a, input, textarea, select, [tabindex]:not([tabindex="-1"])'
      );
      first?.focus();
    }, 30);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        ref={ref}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border border-gray-200 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-auto"
      >
        {children}
      </div>
    </div>
  );
}

function OnboardingModal({ onClose, setMode }) {
  const [step, setStep] = useState(0);
  const steps = [
    {
      title: 'Welcome to AccessibleAID',
      icon: '🤝',
      body: 'Three on-device AI tools designed with disabled users in mind. Models download once, then everything works offline.',
    },
    {
      title: 'Three modes, one purpose',
      icon: '🎯',
      body: '👁 Sight Assistant describes scenes, narrates spatial layout, reads text, and identifies medications.\n🎤 Caption Companion gives on-device live captions, smart sound alerts, and emergency phrases.\n📖 Simplify rewrites complex text in plain language.',
    },
    {
      title: 'Your data stays here',
      icon: '🔒',
      body: 'All inference runs in your browser via WebGPU or WASM. Camera images, microphone audio, and pasted documents never leave your device.',
    },
  ];
  const cur = steps[step];

  return (
    <ModalShell onClose={onClose} label="Welcome">
      <div className="p-6">
        <div className="text-4xl mb-3" aria-hidden="true">
          {cur.icon}
        </div>
        <h2 className="text-2xl font-bold text-ink">{cur.title}</h2>
        <p className="mt-3 text-base text-gray-700 whitespace-pre-line leading-relaxed">
          {cur.body}
        </p>
        <div className="mt-5 flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <span
                key={i}
                aria-hidden="true"
                className={`w-2.5 h-2.5 rounded-full ${
                  i === step ? 'bg-primary' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="tap-target px-4 rounded-xl text-ink hover:bg-gray-100"
              aria-label="Skip the tutorial"
            >
              Skip
            </button>
            {step < steps.length - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="tap-target bg-primary text-white px-4 rounded-xl font-medium"
                aria-label="Next step"
              >
                Next
              </button>
            ) : (
              <button
                onClick={() => {
                  onClose();
                  setMode('home');
                }}
                className="tap-target bg-primary text-white px-4 rounded-xl font-medium"
                aria-label="Start using AccessibleAID"
              >
                Get started
              </button>
            )}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function HowItWorksModal({ onClose }) {
  return (
    <ModalShell onClose={onClose} label="How AccessibleAID works">
      <div className="p-6">
        <h2 className="text-2xl font-bold text-ink">How it works</h2>
        <ol className="mt-4 space-y-4">
          <Step
            n={1}
            title="Models download once"
            body="On first use of a mode, AccessibleAID downloads small AI models (Whisper, ViT-GPT2, TrOCR, DETR, Depth-Anything-v2, MiniLM, AST, and Qwen2.5-1.5B) and caches them in your browser. Every model used is OSI-compatible open source."
          />
          <Step
            n={2}
            title="Everything runs locally"
            body="Inference uses transformers.js with WebGPU when available, or WebAssembly as a fallback. No data leaves your device — no cloud STT, no cloud captioning."
          />
          <Step
            n={3}
            title="Works offline forever"
            body="A service worker caches the app shell and the model weights. After the initial cache, you can disable WiFi and AccessibleAID still works — perfect for clinics, classrooms, and travel."
          />
        </ol>
        <button
          onClick={onClose}
          className="tap-target mt-6 bg-primary text-white px-4 rounded-xl font-medium"
          aria-label="Close how it works"
        >
          Got it
        </button>
      </div>
    </ModalShell>
  );
}

function Step({ n, title, body }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="flex-shrink-0 w-9 h-9 rounded-full bg-primary text-white font-bold flex items-center justify-center"
      >
        {n}
      </span>
      <div>
        <h3 className="font-semibold text-ink">{title}</h3>
        <p className="text-sm text-gray-700 mt-0.5">{body}</p>
      </div>
    </li>
  );
}

function SettingsModal({ onClose, prefs, updatePrefs }) {
  const { voices } = useSpeech();
  const scaleOptions = [
    { v: 1, label: 'Standard' },
    { v: 1.1, label: 'Larger' },
    { v: 1.25, label: 'Large' },
    { v: 1.5, label: 'Extra large' },
  ];

  return (
    <ModalShell onClose={onClose} label="Settings">
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-ink">Settings</h2>
          <button
            onClick={onClose}
            className="tap-target px-3 rounded-lg hover:bg-gray-100"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        <fieldset>
          <legend className="font-semibold text-ink">Text size</legend>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {scaleOptions.map((opt) => (
              <button
                key={opt.v}
                onClick={() => updatePrefs({ fontScale: opt.v })}
                className={`tap-target rounded-xl px-3 py-2 text-sm border ${
                  prefs.fontScale === opt.v
                    ? 'bg-primary text-white border-primary'
                    : 'bg-surface text-ink border-gray-200'
                }`}
                aria-pressed={prefs.fontScale === opt.v}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="font-semibold text-ink">Speech rate</span>
          <input
            type="range"
            min="0.5"
            max="1.8"
            step="0.05"
            value={prefs.speechRate}
            onChange={(e) =>
              updatePrefs({ speechRate: parseFloat(e.target.value) })
            }
            className="w-full mt-2"
            aria-label="Speech rate"
          />
          <div className="text-sm text-gray-600">
            {prefs.speechRate.toFixed(2)}× speed
          </div>
        </label>

        <label className="block">
          <span className="font-semibold text-ink">Voice</span>
          <select
            value={prefs.speechVoiceURI || ''}
            onChange={(e) =>
              updatePrefs({ speechVoiceURI: e.target.value || null })
            }
            className="tap-target mt-2 w-full bg-bg border border-gray-200 rounded-xl px-3"
            aria-label="Speech voice"
          >
            <option value="">System default</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} {v.lang ? `(${v.lang})` : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center justify-between gap-3 bg-bg rounded-xl p-3 border border-gray-200">
          <div>
            <div className="font-semibold text-ink">High contrast mode</div>
            <div className="text-sm text-gray-600">
              Black background with white text.
            </div>
          </div>
          <Toggle
            checked={prefs.highContrast}
            onChange={(v) => updatePrefs({ highContrast: v })}
            label="High contrast"
          />
        </label>

        <label className="flex items-center justify-between gap-3 bg-bg rounded-xl p-3 border border-gray-200">
          <div>
            <div className="font-semibold text-ink">Auto-speak results</div>
            <div className="text-sm text-gray-600">
              Read AI output aloud automatically.
            </div>
          </div>
          <Toggle
            checked={prefs.autoSpeak}
            onChange={(v) => updatePrefs({ autoSpeak: v })}
            label="Auto-speak"
          />
        </label>

        <label className="flex items-center justify-between gap-3 bg-bg rounded-xl p-3 border border-gray-200">
          <div>
            <div className="font-semibold text-ink">Voice-only mode</div>
            <div className="text-sm text-gray-600">
              De-emphasize visuals; rely on narration and haptics.
            </div>
          </div>
          <Toggle
            checked={prefs.voiceOnly}
            onChange={(v) => updatePrefs({ voiceOnly: v })}
            label="Voice-only mode"
          />
        </label>

        <fieldset>
          <legend className="font-semibold text-ink">Compute backend</legend>
          <p className="text-sm text-gray-600 mb-2">
            WebGPU is faster but unavailable in some browsers.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {['auto', 'webgpu', 'wasm'].map((b) => (
              <button
                key={b}
                onClick={() => updatePrefs({ backend: b })}
                className={`tap-target rounded-xl px-3 py-2 text-sm border ${
                  prefs.backend === b
                    ? 'bg-primary text-white border-primary'
                    : 'bg-surface text-ink border-gray-200'
                }`}
                aria-pressed={prefs.backend === b}
              >
                {b}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </ModalShell>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`tap-target relative inline-flex w-14 h-8 rounded-full border ${
        checked ? 'bg-primary border-primary' : 'bg-gray-200 border-gray-300'
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-0.5 left-0.5 w-7 h-7 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : ''
        }`}
      />
    </button>
  );
}
