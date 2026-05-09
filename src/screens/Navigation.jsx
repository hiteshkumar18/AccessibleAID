import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, MapPin, Navigation as NavIcon, AlertCircle, CheckCircle, Wheelchair, Volume2 } from 'lucide-react';
import { useLumyn } from '../context/LumynContext.jsx';
import { useSpeech } from '../hooks/useSpeech.js';
import { PrivacyBadge } from '../components/shared/PrivacyBadge.jsx';

const ROUTE_STEPS = [
  { step: 1, instruction: 'Head north on Main Street', accessible: true, distance: '0.1 mi' },
  { step: 2, instruction: 'Turn right at 2nd Ave — curb cut accessible', accessible: true, distance: '0.2 mi' },
  { step: 3, instruction: 'Elevator on the left — skip stairs ahead', accessible: true, distance: '50 ft' },
  { step: 4, instruction: 'Enter through the automatic door', accessible: true, distance: '20 ft' },
  { step: 5, instruction: 'Destination on your right', accessible: true, distance: 'Arrived' },
];

const NEARBY_HAZARDS = [
  { label: 'Construction zone', severity: 'medium', distance: '0.1 mi' },
  { label: 'Wet surface', severity: 'low', distance: '50 ft' },
];

export default function Navigation() {
  const navigate = useNavigate();
  const { state } = useLumyn();
  const { speak } = useSpeech();
  const [activeStep, setActiveStep] = useState(0);
  const [destination, setDestination] = useState('');

  const currentStep = ROUTE_STEPS[activeStep];
  const wheelchairMode = state.profile?.wheelchairUser;

  const handleSpeak = () => {
    if (currentStep) speak(`Step ${currentStep.step}: ${currentStep.instruction}`);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-gradient-to-br from-white via-[#EFF6FF] to-[#F0FDFA] px-6 pt-14 pb-6 rounded-b-[2rem] shadow-lg">
        <div className="flex items-center gap-4 mb-5">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/home')}
            className="w-12 h-12 bg-white/80 rounded-2xl flex items-center justify-center shadow-md border border-[#0F172A]/5"
          >
            <ArrowLeft className="w-6 h-6 text-[#0F172A]" />
          </motion.button>
          <div>
            <h1 className="text-2xl font-semibold text-[#0F172A]">Accessible Navigation</h1>
            <PrivacyBadge variant="compact" className="mt-0.5" />
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Where would you like to go?"
              className="w-full pl-10 pr-4 py-3 bg-white/80 border border-[#0F172A]/10 rounded-2xl text-[#0F172A] text-base placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30 shadow-sm"
            />
          </div>
          <button className="w-12 h-12 bg-gradient-to-r from-[#3B82F6] to-[#14B8A6] rounded-2xl flex items-center justify-center shadow-lg text-white">
            <NavIcon className="w-6 h-6" />
          </button>
        </div>

        {wheelchairMode && (
          <div className="mt-3 flex items-center gap-2 text-[#10B981] text-sm bg-[#10B981]/10 px-3 py-2 rounded-xl border border-[#10B981]/20">
            <Wheelchair className="w-4 h-4" />
            <span>Wheelchair-accessible routes only</span>
          </div>
        )}
      </div>

      <div className="px-6 mt-6 space-y-4">
        {/* Map placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-gradient-to-br from-[#1E293B] to-[#0F172A] rounded-2xl overflow-hidden h-48 shadow-xl"
        >
          <div className="absolute inset-0 camera-grid opacity-20" />
          <div className="absolute inset-0 flex items-center justify-center text-center p-6">
            <div>
              <NavIcon className="w-10 h-10 text-[#14B8A6] mx-auto mb-2" />
              <p className="text-white font-semibold">Accessible Route Map</p>
              <p className="text-[#94A3B8] text-sm mt-1">On-device navigation — no cloud required</p>
            </div>
          </div>
          {/* Simulated route line */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ filter: 'drop-shadow(0 0 8px rgba(20,184,166,0.6))' }}>
            <polyline points="20%,90% 30%,70% 40%,55% 55%,40% 65%,25% 75%,15%" stroke="#14B8A6" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="8 4" />
            <circle cx="20%" cy="90%" r="5" fill="#14B8A6" />
            <circle cx="75%" cy="15%" r="6" fill="#10B981" />
          </svg>
        </motion.div>

        {/* Current step */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative group"
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-[#3B82F6] to-[#14B8A6] rounded-2xl blur-lg opacity-30 group-hover:opacity-50 transition-opacity" />
          <div className="relative bg-gradient-to-r from-[#3B82F6] to-[#14B8A6] rounded-2xl p-5 shadow-xl border border-white/20">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <NavIcon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-white/80 text-xs mb-1">Step {currentStep?.step} of {ROUTE_STEPS.length}</p>
                <p className="text-white font-bold text-base">{currentStep?.instruction}</p>
                <p className="text-white/70 text-sm mt-1">{currentStep?.distance}</p>
              </div>
              <button
                onClick={handleSpeak}
                className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"
                aria-label="Read step aloud"
              >
                <Volume2 className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* All steps */}
        <div className="space-y-2">
          {ROUTE_STEPS.map((s, i) => (
            <motion.button
              key={s.step}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.06 }}
              onClick={() => setActiveStep(i)}
              className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${
                i === activeStep
                  ? 'bg-gradient-to-r from-[#3B82F6]/10 to-[#14B8A6]/10 border-[#3B82F6]/30'
                  : i < activeStep
                  ? 'bg-white/40 border-white/20 opacity-60'
                  : 'bg-white/80 border-[#0F172A]/5 shadow-sm'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                i < activeStep ? 'bg-[#10B981] text-white' : i === activeStep ? 'bg-gradient-to-r from-[#3B82F6] to-[#14B8A6] text-white' : 'bg-[#F1F5F9] text-[#64748B]'
              } text-sm font-bold`}>
                {i < activeStep ? <CheckCircle className="w-4 h-4" /> : s.step}
              </div>
              <div className="flex-1 text-left">
                <p className={`text-sm font-medium ${i === activeStep ? 'text-[#0F172A]' : 'text-[#475569]'}`}>{s.instruction}</p>
              </div>
              {s.accessible && <Wheelchair className="w-4 h-4 text-[#10B981] flex-shrink-0" />}
            </motion.button>
          ))}
        </div>

        {/* Nearby hazards */}
        {NEARBY_HAZARDS.length > 0 && (
          <div className="bg-[#F59E0B]/10 rounded-2xl p-4 border border-[#F59E0B]/20">
            <h3 className="font-semibold text-[#0F172A] mb-2 flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4 text-[#F59E0B]" />
              Nearby Hazards
            </h3>
            {NEARBY_HAZARDS.map((h, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1">
                <span className="text-[#475569]">{h.label}</span>
                <span className="text-[#64748B]">{h.distance}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
