import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Shield, Cpu, Wifi, Heart, Brain, Eye, Ear } from 'lucide-react';
import { useLumyn } from '../context/LumynContext.jsx';
import { LumynLogoIcon } from '../components/icons/LumynIcons.jsx';

const STEPS = [
  {
    icon: <LumynLogoIcon className="w-16 h-16" />,
    gradient: 'from-[#3B82F6] via-[#14B8A6] to-[#10B981]',
    title: 'Welcome to Lumyn',
    subtitle: 'The future of accessibility intelligence',
    body: 'Lumyn combines on-device AI with emergency survival intelligence to support you anywhere — in classrooms, outdoors, or during disasters.',
    tag: 'Accessibility-first',
  },
  {
    icon: <Shield className="w-14 h-14 text-white" />,
    gradient: 'from-[#10B981] to-[#14B8A6]',
    title: 'Privacy-First AI',
    subtitle: 'Your data never leaves your device',
    body: 'All AI inference runs locally using on-device models. Camera feeds, voice recordings, and your accessibility profile are processed entirely on your device — never uploaded to any cloud.',
    tag: 'Zero cloud upload',
  },
  {
    icon: <Wifi className="w-14 h-14 text-white" />,
    gradient: 'from-[#14B8A6] to-[#3B82F6]',
    title: 'Works Offline',
    subtitle: 'Disaster-ready intelligence',
    body: 'After the first load, Lumyn works completely offline. Emergency guidance, hazard detection, and navigation assistance continue working even when networks are down.',
    tag: 'Offline-capable',
  },
  {
    icon: <Brain className="w-14 h-14 text-white" />,
    gradient: 'from-[#3B82F6] to-[#8B5CF6]',
    title: 'Multi-Agent AI',
    subtitle: '8 specialized agents working for you',
    body: 'Navigation · Accessibility · Emergency · Environmental · Memory · Medical · Social Intelligence · Cognitive Simplification. Every agent runs locally on your device.',
    tag: '8 AI agents',
  },
  {
    icon: <Heart className="w-14 h-14 text-white" />,
    gradient: 'from-[#EF4444] to-[#F59E0B]',
    title: 'Emergency Survival Mode',
    subtitle: 'AI-guided evacuation and safety',
    body: 'Point your camera at any environment and Lumyn detects hazards in real-time, generates accessible evacuation routes, and guides you to safety — adapted to your disability profile.',
    tag: 'Emergency-ready',
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { finishOnboarding } = useLumyn();
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      finishOnboarding();
      navigate('/accessibility-profile');
    } else {
      setStep(step + 1);
    }
  };

  const handleSkip = () => {
    finishOnboarding();
    navigate('/home');
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col overflow-hidden">
      {/* Skip */}
      <div className="flex justify-end p-6">
        <button
          onClick={handleSkip}
          className="text-[#64748B] text-sm font-medium hover:text-[#94A3B8] transition-colors"
        >
          Skip
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 pb-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-sm flex flex-col items-center text-center"
          >
            {/* Icon card */}
            <div className="relative mb-8">
              <div className={`absolute -inset-4 bg-gradient-to-br ${current.gradient} rounded-3xl blur-2xl opacity-40`} />
              <div className={`relative w-28 h-28 bg-gradient-to-br ${current.gradient} rounded-3xl flex items-center justify-center shadow-2xl`}>
                {current.icon}
              </div>
            </div>

            {/* Tag */}
            <span className="privacy-badge mb-4">{current.tag}</span>

            <h2
              className="text-3xl font-bold text-white mb-2 leading-tight"
              style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif' }}
            >
              {current.title}
            </h2>
            <p className="text-[#14B8A6] font-medium text-base mb-4">{current.subtitle}</p>
            <p className="text-[#94A3B8] text-base leading-relaxed">{current.body}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom navigation */}
      <div className="px-8 pb-12 flex flex-col items-center gap-6">
        {/* Progress dots */}
        <div className="flex gap-2">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              aria-label={`Go to step ${i + 1}`}
              className={`rounded-full transition-all duration-300 ${
                i === step
                  ? 'w-8 h-2.5 bg-gradient-to-r from-[#3B82F6] to-[#14B8A6]'
                  : 'w-2.5 h-2.5 bg-[#334155] hover:bg-[#475569]'
              }`}
            />
          ))}
        </div>

        {/* CTA button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleNext}
          className="w-full relative group"
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-[#3B82F6] via-[#14B8A6] to-[#10B981] rounded-2xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />
          <div className="relative bg-gradient-to-r from-[#3B82F6] to-[#14B8A6] text-white py-4 px-8 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 shadow-2xl">
            <span>{isLast ? 'Set Up My Profile' : 'Continue'}</span>
            <ChevronRight className="w-5 h-5" />
          </div>
        </motion.button>
      </div>
    </div>
  );
}
