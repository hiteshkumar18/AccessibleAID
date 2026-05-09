import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, MapPin, Radio, Users, Bell, CheckCircle, Clock, Phone, MessageSquare } from 'lucide-react';
import { useLumyn } from '../context/LumynContext.jsx';
import { PrivacyBadge } from '../components/shared/PrivacyBadge.jsx';

const MOCK_MEMBERS = [
  { id: 1, name: 'Alex (You)', status: 'safe', lastSeen: 'Now', distance: '—', avatar: '🧑' },
  { id: 2, name: 'Mom', status: 'safe', lastSeen: '2 min ago', distance: '0.3 mi', avatar: '👩' },
  { id: 3, name: 'Dad', status: 'unknown', lastSeen: '15 min ago', distance: '1.2 mi', avatar: '👨' },
  { id: 4, name: 'Sis', status: 'help', lastSeen: 'Just now', distance: '0.8 mi', avatar: '👧' },
];

const STATUS_CONFIG = {
  safe: { label: 'Safe', color: 'text-[#10B981]', bg: 'bg-[#10B981]/15', icon: CheckCircle },
  unknown: { label: 'Unknown', color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/15', icon: Clock },
  help: { label: 'Needs Help', color: 'text-[#EF4444]', bg: 'bg-[#EF4444]/15', icon: Bell },
};

export default function FamilySafety() {
  const navigate = useNavigate();
  const { state, updateFamily } = useLumyn();
  const [alertSent, setAlertSent] = useState(false);
  const [message, setMessage] = useState('');

  const handleBroadcast = () => {
    setAlertSent(true);
    updateFamily({ emergencyBroadcast: { message: message || 'I am safe.', time: new Date().toISOString() } });
    setTimeout(() => setAlertSent(false), 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8FAFC] via-[#EFF6FF] to-[#F0FDFA] pb-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-white via-[#EFF6FF] to-[#F0FDFA] px-6 pt-14 pb-6 rounded-b-[2rem] shadow-lg">
        <div className="flex items-center gap-4 mb-4">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/home')}
            className="w-12 h-12 bg-white/80 rounded-2xl flex items-center justify-center shadow-md border border-[#0F172A]/5"
          >
            <ArrowLeft className="w-6 h-6 text-[#0F172A]" />
          </motion.button>
          <div>
            <h1 className="text-2xl font-semibold text-[#0F172A]">Family Safety</h1>
            <PrivacyBadge variant="compact" className="mt-0.5" />
          </div>
        </div>

        {/* Status overview */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gradient-to-r from-[#10B981]/15 to-[#14B8A6]/15 rounded-2xl p-3 text-center border border-[#10B981]/20">
            <p className="text-2xl font-bold text-[#10B981]">2</p>
            <p className="text-xs text-[#475569] mt-0.5">Safe</p>
          </div>
          <div className="bg-gradient-to-r from-[#F59E0B]/15 to-[#EF4444]/15 rounded-2xl p-3 text-center border border-[#F59E0B]/20">
            <p className="text-2xl font-bold text-[#F59E0B]">1</p>
            <p className="text-xs text-[#475569] mt-0.5">Unknown</p>
          </div>
          <div className="bg-gradient-to-r from-[#EF4444]/15 to-[#F59E0B]/15 rounded-2xl p-3 text-center border border-[#EF4444]/20">
            <p className="text-2xl font-bold text-[#EF4444]">1</p>
            <p className="text-xs text-[#475569] mt-0.5">Needs Help</p>
          </div>
        </div>
      </div>

      <div className="px-6 mt-6 space-y-4">
        {/* Family members */}
        <h2 className="text-lg font-bold text-[#0F172A]">Family Members</h2>
        <div className="space-y-3">
          {MOCK_MEMBERS.map((m, i) => {
            const s = STATUS_CONFIG[m.status];
            const Icon = s.icon;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-md border border-[#0F172A]/5"
              >
                <div className="flex items-center gap-4">
                  <div className="text-3xl">{m.avatar}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#0F172A]">{m.name}</span>
                      <span className={`text-xs font-semibold flex items-center gap-1 px-2.5 py-1 rounded-full ${s.bg} ${s.color}`}>
                        <Icon className="w-3 h-3" />
                        {s.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-[#475569]">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{m.lastSeen}</span>
                      {m.distance !== '—' && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{m.distance}</span>}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Broadcast */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-md border border-[#0F172A]/5"
        >
          <h3 className="font-bold text-[#0F172A] mb-3 flex items-center gap-2">
            <Radio className="w-5 h-5 text-[#3B82F6]" />
            Emergency Broadcast
          </h3>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="I am safe at… / Need help at…"
            rows={2}
            className="w-full px-3 py-2.5 bg-[#F8FAFC] border border-[#0F172A]/10 rounded-xl text-[#0F172A] text-sm placeholder-[#94A3B8] resize-none focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30 mb-3"
          />
          <AnimatePresence mode="wait">
            {alertSent ? (
              <motion.div
                key="sent"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="w-full py-3 bg-[#10B981]/15 rounded-xl text-[#10B981] font-semibold text-center text-sm flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Alert sent to all family members
              </motion.div>
            ) : (
              <motion.button
                key="send"
                whileTap={{ scale: 0.97 }}
                onClick={handleBroadcast}
                className="w-full py-3 bg-gradient-to-r from-[#EF4444] to-[#F59E0B] rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg"
              >
                <Bell className="w-4 h-4" />
                Send Emergency Alert
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Regroup */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gradient-to-r from-[#3B82F6]/10 to-[#14B8A6]/10 rounded-2xl p-5 border border-[#3B82F6]/20"
        >
          <h3 className="font-bold text-[#0F172A] mb-2 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#3B82F6]" />
            Regroup Point
          </h3>
          <p className="text-[#475569] text-sm mb-3">Share a meet-up location with your group.</p>
          <div className="grid grid-cols-3 gap-2">
            {['Main Entrance', 'Parking Lot A', 'Custom…'].map((loc) => (
              <button
                key={loc}
                className="py-2.5 bg-white/80 rounded-xl text-[#0F172A] text-xs font-medium border border-[#0F172A]/8 shadow-sm hover:border-[#3B82F6]/30 transition-all"
              >
                {loc}
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
