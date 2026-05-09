import React from 'react';
import { useApp } from '../../context/AppContext.jsx';

const MODES = [
  {
    id: 'sight',
    icon: '👁',
    label: 'Sight Assistant',
    description:
      'Describe scenes, read text aloud, and identify medications using your camera.',
    accent: 'border-primary text-primary',
    badge: 'bg-primary/10 text-primary',
  },
  {
    id: 'caption',
    icon: '🎤',
    label: 'Caption Companion',
    description:
      'Live captions, emergency phrases, and visual alerts for loud sounds.',
    accent: 'border-success text-success',
    badge: 'bg-success/10 text-success',
  },
  {
    id: 'simplify',
    icon: '📖',
    label: 'Simplify',
    description:
      'Turn complex documents into plain, 5th-grade language and ask follow-ups.',
    accent: 'border-purple-700 text-purple-700',
    badge: 'bg-purple-700/10 text-purple-700',
  },
];

export function ModeSelector() {
  const { setMode } = useApp();
  return (
    <section
      aria-labelledby="mode-heading"
      className="px-4 sm:px-6 py-6 mx-auto max-w-2xl"
    >
      <h1 id="mode-heading" className="text-2xl font-bold text-ink mb-2">
        Pick a mode
      </h1>
      <p className="text-gray-600 mb-5">
        AccessibleAID runs three on-device AI tools — choose the one you need.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`tap-target text-left bg-surface border-2 ${m.accent} rounded-2xl p-5 shadow-sm hover:shadow-md focus:shadow-md transition-shadow`}
            aria-label={`${m.label}. ${m.description}`}
          >
            <div className="flex items-center gap-3 mb-2">
              <span aria-hidden="true" className="text-3xl">
                {m.icon}
              </span>
              <span
                className={`uppercase text-xs font-semibold tracking-wide rounded-full px-2 py-0.5 ${m.badge}`}
              >
                Mode
              </span>
            </div>
            <div className="text-xl font-semibold text-ink">{m.label}</div>
            <p className="mt-1 text-base text-gray-600">{m.description}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
