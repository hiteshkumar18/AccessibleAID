import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { LumynLogoIcon } from '../components/icons/LumynIcons.jsx';
import { useLumyn } from '../context/LumynContext.jsx';

export default function Splash() {
  const navigate = useNavigate();
  const { state } = useLumyn();
  const [phase, setPhase] = useState(0); // 0: logo, 1: tagline, 2: fade-out

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 800);
    const t2 = setTimeout(() => setPhase(2), 2200);
    const t3 = setTimeout(() => {
      if (!localStorage.getItem('lumyn:firstRunDone')) {
        navigate('/onboarding');
      } else if (!state.profile.onboardingDone) {
        navigate('/onboarding');
      } else {
        navigate('/home');
      }
    }, 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [navigate, state.profile.onboardingDone]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Ambient light effects */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.2, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/4 left-1/4 w-64 h-64 bg-[#3B82F6]/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ opacity: [0.2, 0.5, 0.2], scale: [1.1, 1, 1.1] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-[#10B981]/15 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ opacity: [0.15, 0.4, 0.15] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#14B8A6]/10 rounded-full blur-3xl"
        />
      </div>

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="relative mb-6"
      >
        <div className="absolute -inset-6 bg-gradient-to-r from-[#3B82F6] via-[#14B8A6] to-[#10B981] rounded-full blur-2xl opacity-40 animate-pulse" />
        <LumynLogoIcon className="relative w-24 h-24" />
      </motion.div>

      {/* Wordmark */}
      <AnimatePresence>
        {phase >= 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-center"
          >
            <h1
              className="text-5xl font-bold tracking-tight mb-2"
              style={{
                background: 'linear-gradient(135deg, #3B82F6, #14B8A6, #10B981)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
              }}
            >
              Lumyn
            </h1>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tagline */}
      <AnimatePresence>
        {phase >= 1 && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-[#94A3B8] text-base font-medium tracking-wide mt-2"
          >
            Privacy-first accessibility intelligence
          </motion.p>
        )}
      </AnimatePresence>

      {/* Privacy indicator */}
      <AnimatePresence>
        {phase >= 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 flex items-center gap-2 text-[#10B981] text-sm"
          >
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            <span>On-Device AI</span>
            <span className="text-[#475569]">·</span>
            <span>No Cloud Upload</span>
            <span className="text-[#475569]">·</span>
            <span>Fully Offline</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading dots */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-16 flex gap-2"
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
            className="w-2 h-2 rounded-full bg-[#3B82F6]"
          />
        ))}
      </motion.div>
    </div>
  );
}
