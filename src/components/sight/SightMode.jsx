import React, { useState } from 'react';
import { SceneDescriber } from './SceneDescriber.jsx';
import { TextReader } from './TextReader.jsx';
import { MedIdentifier } from './MedIdentifier.jsx';
import { SpatialNarrator } from './SpatialNarrator.jsx';
import { useApp } from '../../context/AppContext.jsx';

const TABS = [
  { id: 'scene', label: 'Describe', icon: '🌆' },
  { id: 'spatial', label: "What's around me", icon: '🧭' },
  { id: 'text', label: 'Read text', icon: '🔠' },
  { id: 'med', label: 'Identify medication', icon: '💊' },
];

export function SightMode() {
  const { setMode } = useApp();
  const [tab, setTab] = useState('scene');

  return (
    <main className="px-4 sm:px-6 py-5 mx-auto max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setMode('home')}
          className="tap-target text-primary font-medium px-2 rounded-lg hover:bg-primary/10"
          aria-label="Back to mode selection"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold text-ink">Sight Assistant</h1>
        <span aria-hidden="true" className="text-2xl">👁</span>
      </div>

      <div
        role="tablist"
        aria-label="Sight Assistant tools"
        className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`tab-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`tap-target rounded-xl px-3 py-2 text-sm font-medium border ${
              tab === t.id
                ? 'bg-primary text-white border-primary'
                : 'bg-surface text-ink border-gray-200 hover:bg-gray-100'
            }`}
          >
            <span aria-hidden="true" className="mr-1">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div id={`tab-${tab}`} role="tabpanel">
        {tab === 'scene' && <SceneDescriber />}
        {tab === 'spatial' && <SpatialNarrator />}
        {tab === 'text' && <TextReader />}
        {tab === 'med' && <MedIdentifier />}
      </div>
    </main>
  );
}
