import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronRight, Eye, Ear, Move, Brain, MessageSquare, Accessibility } from 'lucide-react';
import { useLumyn } from '../context/LumynContext.jsx';

const DISABILITY_OPTIONS = [
  { id: 'visual', label: 'Visual Impairment', icon: Eye, description: 'Blind, low vision, or colour blindness' },
  { id: 'hearing', label: 'Hearing Impairment', icon: Ear, description: 'Deaf or hard of hearing' },
  { id: 'mobility', label: 'Mobility / Physical', icon: Move, description: 'Limited mobility or motor control' },
  { id: 'cognitive', label: 'Cognitive / Learning', icon: Brain, description: 'Autism, ADHD, dyslexia, memory' },
  { id: 'speech', label: 'Speech / Communication', icon: MessageSquare, description: 'Non-verbal or speech difficulties' },
];

export default function AccessibilityProfile() {
  const navigate = useNavigate();
  const { updateProfile, finishOnboarding } = useLumyn();
  const [selected, setSelected] = useState(new Set());
  const [wheelchairUser, setWheelchairUser] = useState(false);
  const [name, setName] = useState('');

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleContinue = () => {
    updateProfile({
      name: name.trim(),
      disabilities: Array.from(selected),
      wheelchairUser,
      onboardingDone: true,
    });
    finishOnboarding();
    navigate('/home');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8FAFC] via-[#EFF6FF] to-[#F0FDFA] pb-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-white via-[#EFF6FF] to-[#F0FDFA] px-6 pt-14 pb-8 rounded-b-[2rem] shadow-lg">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="inline-flex items-center gap-2 mb-3 privacy-badge">
            Saved locally — never uploaded
          </div>
          <h1
            className="text-3xl font-bold text-[#0F172A] mb-2"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif' }}
          >
            Your Profile
          </h1>
          <p className="text-[#475569] text-base">
            Lumyn adapts AI assistance to your needs. All data stays on your device.
          </p>
        </motion.div>
      </div>

      <div className="px-6 mt-6 space-y-6 max-w-lg mx-auto">
        {/* Name */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <label className="block text-sm font-semibold text-[#0F172A] mb-2">
            Your name (optional)
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex"
            className="w-full px-4 py-3.5 bg-white/80 border border-[#0F172A]/10 rounded-2xl text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30 shadow-sm text-base"
          />
        </motion.div>

        {/* Disability options */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-sm font-semibold text-[#0F172A] mb-3">
            Select all that apply <span className="text-[#94A3B8] font-normal">(optional)</span>
          </h2>
          <div className="space-y-2.5">
            {DISABILITY_OPTIONS.map(({ id, label, icon: Icon, description }, i) => {
              const active = selected.has(id);
              return (
                <motion.button
                  key={id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.05 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => toggle(id)}
                  aria-pressed={active}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl border transition-all shadow-sm ${
                    active
                      ? 'bg-gradient-to-r from-[#3B82F6]/10 to-[#14B8A6]/10 border-[#3B82F6]/30'
                      : 'bg-white/80 border-[#0F172A]/8 hover:border-[#3B82F6]/20'
                  }`}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    active
                      ? 'bg-gradient-to-r from-[#3B82F6] to-[#14B8A6]'
                      : 'bg-[#F1F5F9]'
                  }`}>
                    <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-[#64748B]'}`} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`font-semibold text-sm ${active ? 'text-[#0F172A]' : 'text-[#0F172A]'}`}>
                      {label}
                    </p>
                    <p className="text-[#64748B] text-xs mt-0.5">{description}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    active ? 'border-[#3B82F6] bg-[#3B82F6]' : 'border-[#CBD5E1]'
                  }`}>
                    {active && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Wheelchair toggle */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setWheelchairUser(!wheelchairUser)}
          aria-pressed={wheelchairUser}
          className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl border transition-all shadow-sm ${
            wheelchairUser
              ? 'bg-gradient-to-r from-[#10B981]/10 to-[#14B8A6]/10 border-[#10B981]/30'
              : 'bg-white/80 border-[#0F172A]/8'
          }`}
        >
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
            wheelchairUser ? 'bg-gradient-to-r from-[#10B981] to-[#14B8A6]' : 'bg-[#F1F5F9]'
          }`}>
            <Accessibility className={`w-5 h-5 ${wheelchairUser ? 'text-white' : 'text-[#64748B]'}`} />
          </div>
          <div className="flex-1 text-left">
            <p className="font-semibold text-sm text-[#0F172A]">Wheelchair / Mobility Aid User</p>
            <p className="text-[#64748B] text-xs mt-0.5">Routes will prioritise accessible paths</p>
          </div>
          <div className={`w-12 h-6 rounded-full relative transition-all ${
            wheelchairUser ? 'bg-[#10B981]' : 'bg-[#CBD5E1]'
          }`}>
            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              wheelchairUser ? 'translate-x-6' : 'translate-x-0'
            }`} />
          </div>
        </motion.button>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <button
            onClick={handleContinue}
            className="w-full relative group mt-2"
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-[#3B82F6] via-[#14B8A6] to-[#10B981] rounded-2xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity" />
            <div className="relative bg-gradient-to-r from-[#3B82F6] to-[#14B8A6] text-white py-4 px-8 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 shadow-2xl">
              <span>Enter Lumyn</span>
              <ChevronRight className="w-5 h-5" />
            </div>
          </button>
          <button
            onClick={() => navigate('/home')}
            className="w-full text-center text-[#94A3B8] text-sm mt-4 py-2"
          >
            Skip for now
          </button>
        </motion.div>
      </div>
    </div>
  );
}
