import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Camera, Clock, TrendingUp, Shield, Sparkles, Settings,
} from 'lucide-react';
import {
  BrainAccessibilityIcon, WorldEyeIcon, EmergencyShieldIcon,
  NavigationCompassIcon, CaptionBubbleIcon, SignHandIcon,
  FamilyGroupIcon, AIAgentIcon,
} from '../components/icons/LumynIcons.jsx';
import { PrivacyBadge } from '../components/shared/PrivacyBadge.jsx';
import { useLumyn } from '../context/LumynContext.jsx';

export default function Home() {
  const navigate = useNavigate();
  const { state } = useLumyn();

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const activeAgents = Object.values(state.agents).filter((s) => s !== 'idle').length;
  const modelsLoaded = Object.values(state.modelsReady).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8FAFC] via-[#EFF6FF] to-[#F0FDFA] pb-28 lg:pb-8">
      <div className="max-w-7xl mx-auto">

        {/* Hero Header */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.08),transparent_50%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_60%,rgba(20,184,166,0.06),transparent_50%)] pointer-events-none" />

          <div className="relative px-6 lg:px-12 pt-14 pb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#0F172A] tracking-tight"
                  style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif' }}
                >
                  {greeting()}{state.profile?.name ? `, ${state.profile.name}` : ''}
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-[#475569] text-base mt-1"
                >
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </motion.p>
              </div>

              <div className="flex items-center gap-3">
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/ai-orchestration')}
                  aria-label="AI Orchestration"
                  className="w-12 h-12 md:w-14 md:h-14 bg-white/60 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/80 shadow-xl hover:shadow-2xl transition-all"
                >
                  <AIAgentIcon className="w-7 h-7" />
                </motion.button>
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/accessibility-profile')}
                  aria-label="Accessibility profile settings"
                  className="w-12 h-12 md:w-14 md:h-14 bg-white/60 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/80 shadow-xl hover:shadow-2xl transition-all"
                >
                  <Settings className="w-6 h-6 text-[#475569]" />
                </motion.button>
              </div>
            </div>

            {/* Status banner */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="relative group mb-6"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-[#3B82F6] via-[#14B8A6] to-[#10B981] rounded-3xl blur-xl opacity-25 group-hover:opacity-40 transition-opacity" />
              <div className="relative bg-gradient-to-r from-[#3B82F6] to-[#14B8A6] rounded-2xl lg:rounded-3xl p-5 lg:p-6 shadow-2xl border border-white/20">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 h-12 lg:w-14 lg:h-14 bg-white/20 rounded-2xl flex items-center justify-center ring-2 ring-white/30">
                    <Shield className="w-6 h-6 lg:w-7 lg:h-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold text-base lg:text-lg flex items-center gap-2">
                      {state.online ? 'All Systems Ready' : 'Offline Mode Active'}
                      <Sparkles className="w-4 h-4" />
                    </h3>
                    <p className="text-white/90 text-sm mt-0.5">
                      {state.online
                        ? 'Accessibility AI active'
                        : 'On-device AI running · No internet required · Emergency guidance available'}
                    </p>
                  </div>
                  <PrivacyBadge variant="compact" className="flex-shrink-0 !text-white/90 !bg-white/20 !border-white/30 hidden sm:inline-flex" />
                </div>
              </div>
            </motion.div>

           
          </div>
        </div>

        {/* Main content */}
        <div className="px-6 lg:px-12 mt-6 lg:mt-10">
          {/* AI Actions */}
          <SectionHeader title="AI Actions" delay={0.5} />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-4 mb-10">
            <AIActionButton icon={<WorldEyeIcon className="w-7 h-7" />} label="Understand World" onClick={() => navigate('/world-understanding')} gradient="from-[#10B981] to-[#3B82F6]" delay={0.55} />
            <AIActionButton icon={<Camera className="w-7 h-7" />} label="Scene Camera" onClick={() => navigate('/scene-camera')} gradient="from-[#3B82F6] to-[#14B8A6]" delay={0.6} />
            {/* <AIActionButton icon={<NavigationCompassIcon className="w-7 h-7" />} label="Navigate" onClick={() => navigate('/navigation')} gradient="from-[#3B82F6] to-[#10B981]" delay={0.65} /> */}
            <AIActionButton icon={<CaptionBubbleIcon className="w-7 h-7" />} label="Live Captions" onClick={() => navigate('/live-captioning')} gradient="from-[#14B8A6] to-[#3B82F6]" delay={0.7} />
            <AIActionButton icon={<SignHandIcon className="w-7 h-7" />} label="Sign Language" onClick={() => navigate('/sign-language')} gradient="from-[#10B981] to-[#14B8A6]" delay={0.75} />
            <AIActionButton icon={<BrainAccessibilityIcon className="w-7 h-7" />} label="Simplify Info" onClick={() => navigate('/simplify')} gradient="from-[#3B82F6] to-[#10B981]" delay={0.8} />
          </div>

          {/* Privacy indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.3 }}
            className="mt-8 flex justify-center"
          >
            <PrivacyBadge variant="full" />
          </motion.div>
        </div>
      </div>

      {/* Bottom nav — mobile */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/70 backdrop-blur-2xl border-t border-[#0F172A]/5 px-6 py-3 shadow-2xl bottom-nav">
        <div className="flex justify-around items-center max-w-md mx-auto">
          <NavBtn icon={<BrainAccessibilityIcon className="w-6 h-6" />} label="Home" active />
          <NavBtn icon={<Camera className="w-6 h-6" />} label="Camera" onClick={() => navigate('/scene-camera')} />
          <NavBtn icon={<EmergencyShieldIcon className="w-6 h-6" />} label="Emergency" onClick={() => navigate('/emergency')} />
          <NavBtn icon={<FamilyGroupIcon className="w-6 h-6" />} label="Safety" onClick={() => navigate('/family-safety')} />
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, delay }) {
  return (
    <motion.h2
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="text-xl lg:text-2xl font-bold text-[#0F172A] mb-5"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif' }}
    >
      {title}
    </motion.h2>
  );
}

function StatusCard({ icon, label, value, color, delay }) {
  const c = {
    emerald: { bg: 'from-[#10B981]/10 to-[#14B8A6]/10', text: 'text-[#10B981]' },
    blue:    { bg: 'from-[#3B82F6]/10 to-[#14B8A6]/10', text: 'text-[#3B82F6]' },
    purple:  { bg: 'from-[#8B5CF6]/10 to-[#6366F1]/10', text: 'text-[#8B5CF6]' },
    teal:    { bg: 'from-[#14B8A6]/10 to-[#06B6D4]/10', text: 'text-[#14B8A6]' },
  }[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -4 }}
      className="bg-white/60 backdrop-blur-xl rounded-2xl p-4 lg:p-5 shadow-xl border border-white/80 hover:shadow-2xl transition-all"
    >
      <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl flex items-center justify-center mb-3 bg-gradient-to-r ${c.bg} ${c.text} shadow-md`}>
        {icon}
      </div>
      <p className="text-xs lg:text-sm text-[#475569] mb-1 font-medium">{label}</p>
      <p className="font-bold text-[#0F172A] text-base lg:text-lg">{value}</p>
    </motion.div>
  );
}

function AIActionButton({ icon, label, onClick, gradient, delay }) {
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay }}
      whileHover={{ scale: 1.05, y: -4 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="relative group"
    >
      <div className={`absolute -inset-1 bg-gradient-to-br ${gradient} rounded-2xl lg:rounded-3xl blur-lg opacity-30 group-hover:opacity-60 transition-opacity`} />
      <div className={`relative bg-gradient-to-br ${gradient} rounded-2xl lg:rounded-3xl p-4 lg:p-6 shadow-xl flex flex-col items-center justify-center gap-3 min-h-[120px] lg:min-h-[140px] border border-white/20`}>
        <div className="text-white">{icon}</div>
        <span className="text-white text-sm lg:text-base font-semibold text-center leading-tight">{label}</span>
      </div>
    </motion.button>
  );
}

function EmergencyButton({ icon, label, description, onClick, color, delay }) {
  const c = {
    emergency: 'from-[#F59E0B] to-[#EF4444]',
    blue: 'from-[#3B82F6] to-[#14B8A6]',
    red: 'from-[#EF4444] to-[#F59E0B]',
  }[color];

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="relative group text-left"
    >
      <div className={`absolute -inset-1 bg-gradient-to-r ${c} rounded-2xl lg:rounded-3xl blur-xl opacity-35 group-hover:opacity-55 transition-opacity`} />
      <div className={`relative bg-gradient-to-r ${c} rounded-2xl lg:rounded-3xl p-5 lg:p-6 shadow-2xl flex items-center gap-4 lg:gap-5 border border-white/20`}>
        <div className="flex-shrink-0 w-14 h-14 lg:w-16 lg:h-16 bg-white/20 backdrop-blur-sm rounded-xl lg:rounded-2xl flex items-center justify-center ring-2 ring-white/30 text-white">
          {icon}
        </div>
        <div>
          <h3 className="text-white font-semibold text-base lg:text-lg">{label}</h3>
          <p className="text-white/90 text-sm mt-0.5">{description}</p>
        </div>
      </div>
    </motion.button>
  );
}

function QuickCard({ icon, label, badge, onClick, delay }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="relative bg-white/60 backdrop-blur-xl rounded-2xl p-4 lg:p-5 shadow-xl border border-white/80 flex flex-col items-start hover:shadow-2xl transition-all"
    >
      {badge !== undefined && (
        <div className="absolute top-3 right-3 w-6 h-6 bg-gradient-to-r from-[#3B82F6] to-[#14B8A6] rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg">
          {badge}
        </div>
      )}
      <div className="w-11 h-11 lg:w-12 lg:h-12 bg-gradient-to-r from-[#3B82F6]/10 to-[#14B8A6]/10 rounded-xl lg:rounded-2xl flex items-center justify-center text-[#3B82F6] mb-3 shadow-md">
        {icon}
      </div>
      <p className="text-sm lg:text-base font-semibold text-[#0F172A]">{label}</p>
    </motion.button>
  );
}

function NavBtn({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 min-w-[56px] group"
      aria-current={active ? 'page' : undefined}
    >
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
        active
          ? 'bg-gradient-to-r from-[#3B82F6] to-[#14B8A6] shadow-lg'
          : 'bg-transparent text-[#94A3B8] group-hover:bg-[#F1F5F9]'
      }`}>
        {active ? <div className="text-white">{icon}</div> : icon}
      </div>
      <span className={`text-xs font-medium ${active ? 'text-[#0F172A]' : 'text-[#94A3B8]'}`}>{label}</span>
    </button>
  );
}
