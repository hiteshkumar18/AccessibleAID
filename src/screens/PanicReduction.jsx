import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Heart, Wind, Clock, Shield } from 'lucide-react';
import { useLumyn } from '../context/LumynContext.jsx';
import { useSpeech } from '../hooks/useSpeech.js';
import { vibrate } from '../utils/haptics.js';

const BREATHING_PHASES = [
  { label: 'Breathe In', duration: 4000, color: 'from-[#3B82F6] to-[#14B8A6]', scale: 1.6 },
  { label: 'Hold', duration: 4000, color: 'from-[#14B8A6] to-[#10B981]', scale: 1.6 },
  { label: 'Breathe Out', duration: 6000, color: 'from-[#10B981] to-[#3B82F6]', scale: 1.0 },
  { label: 'Hold', duration: 2000, color: 'from-[#3B82F6] to-[#10B981]', scale: 1.0 },
];

const GROUNDING_PROMPTS = [
  '5 things you can SEE right now',
  '4 things you can TOUCH right now',
  '3 things you can HEAR right now',
  '2 things you can SMELL right now',
  '1 thing you can TASTE right now',
];

export default function PanicReduction() {
  const navigate = useNavigate();
  const { setPanicMode, state } = useLumyn();
  const { speak } = useSpeech();
  const [breathPhase, setBreathPhase] = useState(0);
  const [active, setActive] = useState(false);
  const [groundingIdx, setGroundingIdx] = useState(0);
  const [tab, setTab] = useState('breathing'); // 'breathing' | 'grounding' | 'affirmations'

  useEffect(() => {
    setPanicMode(true);
    return () => setPanicMode(false);
  }, [setPanicMode]);

  useEffect(() => {
    if (!active) return;
    const phase = BREATHING_PHASES[breathPhase];
    vibrate('heartbeat');
    const t = setTimeout(() => {
      setBreathPhase((p) => (p + 1) % BREATHING_PHASES.length);
    }, phase.duration);
    return () => clearTimeout(t);
  }, [active, breathPhase]);

  const currentPhase = BREATHING_PHASES[breathPhase];
  const totalDuration = currentPhase.duration / 1000;

  const AFFIRMATIONS = [
    'You are safe right now.',
    'This feeling will pass.',
    'You have survived difficult moments before.',
    'Take it one breath at a time.',
    'You are not alone.',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F172A] via-[#0F2A1A] to-[#0F172A] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 pt-14 pb-6">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate(-1)}
          className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10"
        >
          <ArrowLeft className="w-6 h-6 text-white" />
        </motion.button>
        <div>
          <h1 className="text-2xl font-bold text-white">Calm Mode</h1>
          <p className="text-[#94A3B8] text-sm">Panic Reduction AI • On-Device</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-6 mb-6">
        {['breathing', 'grounding', 'affirmations'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold capitalize transition-all ${
              tab === t
                ? 'bg-gradient-to-r from-[#3B82F6] to-[#14B8A6] text-white shadow-lg'
                : 'bg-white/10 text-[#94A3B8]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {tab === 'breathing' && (
          <>
            {/* Breathing circle */}
            <div className="relative flex items-center justify-center mb-8">
              <motion.div
                animate={active ? {
                  scale: [1, currentPhase.scale, currentPhase.scale, 1],
                } : { scale: 1 }}
                transition={{ duration: totalDuration, ease: 'easeInOut', repeat: active ? Infinity : 0 }}
                className={`w-48 h-48 rounded-full bg-gradient-to-br ${currentPhase.color} opacity-20`}
              />
              <motion.div
                animate={active ? {
                  scale: [0.8, currentPhase.scale * 0.85],
                } : { scale: 0.8 }}
                transition={{ duration: totalDuration, ease: 'easeInOut', repeat: active ? Infinity : 0 }}
                className={`absolute w-36 h-36 rounded-full bg-gradient-to-br ${currentPhase.color} opacity-40`}
              />
              <motion.div
                animate={active ? {
                  scale: [0.6, currentPhase.scale * 0.7],
                } : { scale: 0.6 }}
                transition={{ duration: totalDuration, ease: 'easeInOut', repeat: active ? Infinity : 0 }}
                className={`absolute w-24 h-24 rounded-full bg-gradient-to-br ${currentPhase.color}`}
              />
              <div className="absolute text-center">
                <Wind className="w-8 h-8 text-white mx-auto mb-1" />
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.p
                key={breathPhase}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-3xl font-bold text-white mb-2 text-center"
              >
                {active ? currentPhase.label : 'Box Breathing'}
              </motion.p>
            </AnimatePresence>
            <p className="text-[#94A3B8] text-center text-sm mb-8">
              {active ? `${totalDuration} seconds` : '4-4-6-2 pattern to calm your nervous system'}
            </p>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActive(!active)}
              className={`px-10 py-4 rounded-2xl font-bold text-lg shadow-2xl ${
                active
                  ? 'bg-white/10 border border-white/20 text-white'
                  : 'bg-gradient-to-r from-[#3B82F6] to-[#14B8A6] text-white'
              }`}
            >
              {active ? 'Stop' : 'Start Breathing'}
            </motion.button>
          </>
        )}

        {tab === 'grounding' && (
          <div className="w-full max-w-sm">
            <div className="text-center mb-8">
              <Shield className="w-16 h-16 mx-auto text-[#10B981] mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">5-4-3-2-1 Grounding</h2>
              <p className="text-[#94A3B8] text-sm">Focus on your senses to return to the present moment</p>
            </div>
            <div className="space-y-3">
              {GROUNDING_PROMPTS.map((prompt, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`p-4 rounded-2xl border transition-all ${
                    i === groundingIdx
                      ? 'bg-gradient-to-r from-[#3B82F6]/20 to-[#14B8A6]/20 border-[#3B82F6]/40'
                      : i < groundingIdx
                      ? 'bg-white/5 border-white/5 opacity-50'
                      : 'bg-white/10 border-white/10'
                  }`}
                >
                  <p className="text-white font-medium">{prompt}</p>
                </motion.div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setGroundingIdx(Math.max(0, groundingIdx - 1))}
                className="flex-1 py-3 bg-white/10 rounded-2xl text-white border border-white/10"
                disabled={groundingIdx === 0}
              >Previous</button>
              <button
                onClick={() => setGroundingIdx(Math.min(GROUNDING_PROMPTS.length - 1, groundingIdx + 1))}
                className="flex-1 py-3 bg-gradient-to-r from-[#3B82F6] to-[#14B8A6] rounded-2xl text-white font-semibold"
              >Next</button>
            </div>
          </div>
        )}

        {tab === 'affirmations' && (
          <div className="w-full max-w-sm text-center">
            <Heart className="w-16 h-16 mx-auto text-[#EF4444] mb-8 animate-pulse" />
            <div className="space-y-4">
              {AFFIRMATIONS.map((a, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.15 }}
                  className="bg-white/10 backdrop-blur-xl rounded-2xl p-5 border border-white/15 shadow-xl"
                >
                  <p className="text-white text-xl font-semibold leading-relaxed">{a}</p>
                  <button
                    onClick={() => speak(a)}
                    className="mt-3 text-sm text-[#14B8A6] font-medium"
                  >
                    Read aloud
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
