import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Cpu, CheckCircle2, Loader2, Smartphone } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { MODEL_BY_ID, ALL_MODELS } from '../../config/models.js';

const CATEGORY_COLORS = {
  Vision:   { from: '#3B82F6', to: '#8B5CF6', glow: 'rgba(59,130,246,0.25)',   bg: 'rgba(59,130,246,0.10)'  },
  Audio:    { from: '#10B981', to: '#14B8A6', glow: 'rgba(16,185,129,0.25)',   bg: 'rgba(16,185,129,0.10)'  },
  Language: { from: '#F59E0B', to: '#EF4444', glow: 'rgba(245,158,11,0.25)',   bg: 'rgba(245,158,11,0.10)'  },
};

function humanMB(mb) {
  if (!mb) return '';
  return mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${mb} MB`;
}

function parseModelFromKey(loaderKey) {
  const parts = loaderKey.split(':');
  if (parts.length < 3) return null;
  const modelId = parts.slice(2).join(':');
  return MODEL_BY_ID[modelId] || null;
}

// ─── Single active model card (downloading right now) ──────────────────────
function ActiveModelCard({ loaderKey, data }) {
  const meta  = parseModelFromKey(loaderKey);
  const pct   = Math.round(data.progress || 0);
  const c     = CATEGORY_COLORS[meta?.category] || CATEGORY_COLORS.Vision;
  const lines = (data.detail || '').split('\n').filter(Boolean);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.3 }}
      className="relative rounded-2xl overflow-hidden border border-white/10"
      style={{ background: 'rgba(15,23,42,0.90)' }}
    >
      {/* Glow behind card when active */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at top, ${c.glow}, transparent 70%)` }}
      />

      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ background: `linear-gradient(to bottom, ${c.from}, ${c.to})` }}
      />

      <div className="pl-5 pr-4 pt-3.5 pb-3">
        {/* Model header */}
        <div className="flex items-start gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: c.bg }}
          >
            {meta?.icon || '🤖'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-white font-bold text-sm">{meta?.name || data.label || 'AI Model'}</p>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest"
                style={{ background: c.bg, color: c.from }}
              >
                {meta?.category || 'AI'}
              </span>
            </div>
            <p className="text-[#94A3B8] text-xs mt-0.5 leading-snug">{meta?.description || 'Initialising…'}</p>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="font-bold text-sm tabular-nums" style={{ color: c.from }}>{pct}%</p>
            {meta?.sizeMB && (
              <p className="text-[10px] text-[#64748B]">{humanMB(meta.sizeMB)}</p>
            )}
          </div>
        </div>

        {/* Main progress bar */}
        <div className="w-full h-2 bg-white/8 rounded-full overflow-hidden mb-2.5">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(to right, ${c.from}, ${c.to})`,
              boxShadow: `0 0 12px ${c.from}80`,
            }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>

        {/* File-level log lines */}
        {lines.length > 0 && (
          <div className="space-y-0.5 font-mono">
            {lines.slice(0, 4).map((line, i) => {
              const done = line.includes('— 100%');
              return (
                <div key={i} className="flex items-center gap-1.5">
                  {done
                    ? <CheckCircle2 className="w-3 h-3 flex-shrink-0" style={{ color: c.from }} />
                    : <Loader2 className="w-3 h-3 flex-shrink-0 animate-spin" style={{ color: c.to }} />
                  }
                  <p className="text-[10px] text-[#475569] truncate">{line}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Prod note */}
        {meta?.demoNote && (
          <div className="mt-2.5 flex items-center gap-1.5 bg-white/5 rounded-lg px-2.5 py-1.5">
            <Smartphone className="w-3 h-3 text-[#64748B] flex-shrink-0" />
            <p className="text-[10px] text-[#64748B] leading-snug">{meta.demoNote}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Compact idle chip for models waiting in queue ──────────────────────────
function QueuedModelChip({ model }) {
  const c = CATEGORY_COLORS[model.category] || CATEGORY_COLORS.Vision;
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/8"
      style={{ background: 'rgba(15,23,42,0.70)' }}
    >
      <span className="text-base">{model.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-white/60 text-xs font-medium truncate">{model.shortName}</p>
        <p className="text-[#475569] text-[10px] truncate">{humanMB(model.sizeMB)}</p>
      </div>
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.from, opacity: 0.5 }} />
    </div>
  );
}

// ─── Main overlay ──────────────────────────────────────────────────────────
export function LoadingOverlay() {
  const { state } = useApp();
  const logEndRef = useRef(null);
  const entries   = Object.entries(state.loaders || {});

  // Build the set of model IDs currently loading
  const loadingIds = new Set(
    entries.map(([key]) => {
      const parts = key.split(':');
      return parts.slice(2).join(':');
    })
  );

  // Models queued but not started yet (shown as waiting chips)
  const queuedModels = ALL_MODELS.filter((m) => !loadingIds.has(m.id));

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [entries.length]);

  return (
    <AnimatePresence>
      {entries.length > 0 && (
        <motion.div
          key="lumyn-download-overlay"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-4 right-4 left-4 md:left-auto z-50 md:w-[420px]"
          role="status"
          aria-live="polite"
          aria-label="AI model download progress"
        >
          <div
            className="rounded-3xl overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.5)] border border-white/10"
            style={{
              background: 'rgba(8,14,28,0.96)',
              backdropFilter: 'blur(32px)',
              WebkitBackdropFilter: 'blur(32px)',
            }}
          >
            {/* ── Header ── */}
            <div className="px-5 pt-4 pb-3 border-b border-white/8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#14B8A6] flex items-center justify-center shadow-lg">
                    <Cpu className="w-4.5 h-4.5 text-white" />
                  </div>
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#10B981] rounded-full border-2 border-[#080e1c] animate-pulse" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm leading-tight">Downloading AI Models</p>
                  <p className="text-[#64748B] text-xs">
                    {entries.length} active · runs on-device · no cloud
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 bg-[#10B981]/12 px-2.5 py-1.5 rounded-full border border-[#10B981]/25">
                <Shield className="w-3 h-3 text-[#10B981]" />
                <span className="text-[10px] text-[#10B981] font-bold tracking-wide">On-Device</span>
              </div>
            </div>

            {/* ── Active downloads ── */}
            <div className="p-3 space-y-2 max-h-[50vh] overflow-y-auto">
              <AnimatePresence mode="popLayout">
                {entries.map(([key, data]) => (
                  <ActiveModelCard key={key} loaderKey={key} data={data} />
                ))}
              </AnimatePresence>
              <div ref={logEndRef} />
            </div>

            {/* ── Queued models (mini chips) ── */}
            {queuedModels.length > 0 && (
              <div className="px-3 pb-3 border-t border-white/5 pt-2">
                <p className="text-[#475569] text-[10px] uppercase tracking-widest font-semibold mb-1.5 px-1">
                  Queued
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {queuedModels.slice(0, 6).map((m) => (
                    <QueuedModelChip key={m.id} model={m} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Footer ── */}
            <div className="px-5 pb-3.5 pt-2 border-t border-white/5">
              <p className="text-[#334155] text-[11px] text-center leading-snug">
                Downloaded once · cached in browser · models never leave your device
              </p>
              <p className="text-[#1e3a5f] text-[10px] text-center mt-0.5">
                Demo uses full-size models · production uses quantized (q4/q8) phone variants
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
