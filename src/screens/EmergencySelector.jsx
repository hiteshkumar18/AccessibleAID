import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Flame, Activity, Waves, Users, Siren, Heart } from 'lucide-react';
import { useLumyn } from '../context/LumynContext.jsx';
import { EmergencyShieldIcon } from '../components/icons/LumynIcons.jsx';

const EMERGENCIES = [
  { id: 'fire', label: 'Fire / Smoke', icon: Flame, description: 'Building fire, wildfires, smoke', color: 'from-red-500 to-orange-500', path: '/emergency-camera' },
  { id: 'earthquake', label: 'Earthquake', icon: Activity, description: 'Seismic event, structural damage', color: 'from-orange-500 to-yellow-500', path: '/emergency-camera' },
  { id: 'flood', label: 'Flood / Water', icon: Waves, description: 'Flash floods, water hazards', color: 'from-blue-500 to-cyan-500', path: '/emergency-camera' },
  { id: 'shooter', label: 'Active Threat', icon: Siren, description: 'Lockdown, active shooter', color: 'from-red-600 to-red-400', path: '/emergency-camera' },
  { id: 'crowd', label: 'Crowd Crush', icon: Users, description: 'Stampede, overcrowding', color: 'from-purple-500 to-pink-500', path: '/emergency-camera' },
  { id: 'medical', label: 'Medical Emergency', icon: Heart, description: 'First aid, emergency medical', color: 'from-red-400 to-rose-600', path: '/medical' },
];

export default function EmergencySelector() {
  const navigate = useNavigate();
  const { activateEmergency } = useLumyn();

  const handleSelect = (e) => {
    activateEmergency(e.id);
    navigate(e.path);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F172A] via-[#1A0F0F] to-[#0F172A] pb-10">
      {/* Header */}
      <div className="px-6 pt-14 pb-8">
        <div className="flex items-center gap-4 mb-8">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/home')}
            className="w-12 h-12 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/10"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </motion.button>
          <div>
            <h1 className="text-2xl font-bold text-white">Emergency Mode</h1>
            <p className="text-[#94A3B8] text-sm mt-0.5">Select emergency type — AI adapts guidance</p>
          </div>
        </div>

        {/* Emergency banner */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative group mb-8"
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-orange-500 rounded-3xl blur-xl opacity-40 animate-pulse" />
          <div className="relative bg-gradient-to-r from-red-500/90 to-orange-500/90 rounded-2xl p-5 border border-red-400/40 shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center ring-2 ring-white/30">
                <EmergencyShieldIcon className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">Survival AI Activated</h2>
                <p className="text-white/90 text-sm">On-device AI · No cloud required · Works offline</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Emergency grid */}
        <div className="grid grid-cols-2 gap-4">
          {EMERGENCIES.map((e, i) => {
            const Icon = e.icon;
            return (
              <motion.button
                key={e.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleSelect(e)}
                className="relative group text-left"
              >
                <div className={`absolute -inset-1 bg-gradient-to-br ${e.color} rounded-2xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity`} />
                <div className={`relative bg-gradient-to-br ${e.color} rounded-2xl p-5 shadow-2xl border border-white/20 min-h-[130px] flex flex-col justify-between`}>
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-base leading-tight">{e.label}</h3>
                    <p className="text-white/80 text-xs mt-1">{e.description}</p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Panic mode */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/panic-reduction')}
          className="w-full mt-5 bg-white/10 backdrop-blur-xl text-white py-4 rounded-2xl border border-white/15 font-semibold flex items-center justify-center gap-3 hover:bg-white/15 transition-colors"
        >
          <Heart className="w-5 h-5 text-teal-400" />
          Activate Panic Reduction Mode
        </motion.button>
      </div>
    </div>
  );
}
