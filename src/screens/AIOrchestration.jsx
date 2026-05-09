import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Brain, Eye, Shield, Navigation, Activity, Heart, Users, Cpu, RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { useLumyn } from '../context/LumynContext.jsx';
import { PrivacyBadge } from '../components/shared/PrivacyBadge.jsx';

const AGENT_DEFINITIONS = [
  {
    id: 'navigation',
    label: 'Navigation Agent',
    icon: Navigation,
    color: 'from-[#3B82F6] to-[#14B8A6]',
    desc: 'Accessible routing, obstacle detection, turn-by-turn guidance',
    capabilities: ['Wheelchair-safe routes', 'Elevator detection', 'Real-time rerouting'],
  },
  {
    id: 'accessibility',
    label: 'Accessibility Agent',
    icon: Brain,
    color: 'from-[#8B5CF6] to-[#3B82F6]',
    desc: 'Adapts UI contrast, font, speech rate, cognitive load to your profile',
    capabilities: ['Dynamic UI adaptation', 'Cognitive load sensing', 'Profile learning'],
  },
  {
    id: 'emergency',
    label: 'Emergency Agent',
    icon: Shield,
    color: 'from-[#EF4444] to-[#F59E0B]',
    desc: 'Threat classification, evacuation path generation, family alerts',
    capabilities: ['Threat severity scoring', 'Evacuation planning', 'Panic detection'],
  },
  {
    id: 'environmental',
    label: 'Environmental Agent',
    icon: Eye,
    color: 'from-[#14B8A6] to-[#10B981]',
    desc: 'Scene understanding, object detection, hazard identification',
    capabilities: ['DETR object detection', 'Hazard mapping', 'Scene narration'],
  },
  {
    id: 'memory',
    label: 'Memory Agent',
    icon: Cpu,
    color: 'from-[#6366F1] to-[#8B5CF6]',
    desc: 'Contextual recall, preference learning, session persistence',
    capabilities: ['Local vector memory', 'Preference recall', 'Cross-session context'],
  },
  {
    id: 'medical',
    label: 'Medical Agent',
    icon: Activity,
    color: 'from-[#EF4444] to-[#EC4899]',
    desc: 'Medication identification, RAG knowledge base, first aid guidance',
    capabilities: ['MiniLM RAG search', 'Drug identification', 'First aid protocols'],
  },
  {
    id: 'social',
    label: 'Social Agent',
    icon: Users,
    color: 'from-[#F59E0B] to-[#FB923C]',
    desc: 'Sign language translation, captions, family safety coordination',
    capabilities: ['ASL translation', 'Live captions', 'Family broadcasts'],
  },
  {
    id: 'cognitive',
    label: 'Cognitive Agent',
    icon: Heart,
    color: 'from-[#EC4899] to-[#EF4444]',
    desc: 'Emotional state inference, panic reduction, breathing exercises',
    capabilities: ['Emotion inference', 'Panic reduction', 'Calm prompting'],
  },
];

function statusFromAgent(agentState) {
  if (!agentState) return 'idle';
  return agentState.status ?? 'idle';
}

function StatusDot({ status }) {
  if (status === 'active') return <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-2.5 h-2.5 rounded-full bg-[#10B981] flex-shrink-0" />;
  if (status === 'loading') return <RefreshCw className="w-3 h-3 text-[#F59E0B] animate-spin flex-shrink-0" />;
  if (status === 'error') return <AlertCircle className="w-3 h-3 text-[#EF4444] flex-shrink-0" />;
  return <span className="w-2.5 h-2.5 rounded-full bg-[#CBD5E1] flex-shrink-0" />;
}

export default function AIOrchestration() {
  const navigate = useNavigate();
  const { state } = useLumyn();
  const [expandedAgent, setExpandedAgent] = useState(null);

  const activeCount = AGENT_DEFINITIONS.filter((a) => statusFromAgent(state.agents?.[a.id]) === 'active').length;
  const idleCount = AGENT_DEFINITIONS.length - activeCount;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] px-6 pt-14 pb-6 rounded-b-[2rem] shadow-lg">
        <div className="flex items-center gap-4 mb-5">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/home')}
            className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center shadow-md border border-white/10"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </motion.button>
          <div>
            <h1 className="text-2xl font-semibold text-white">AI Orchestration</h1>
            <PrivacyBadge variant="compact" className="mt-0.5" />
          </div>
        </div>

        {/* Agent stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/10 rounded-2xl p-3 text-center border border-white/10">
            <p className="text-2xl font-bold text-white">{AGENT_DEFINITIONS.length}</p>
            <p className="text-xs text-white/60 mt-0.5">Total</p>
          </div>
          <div className="bg-[#10B981]/20 rounded-2xl p-3 text-center border border-[#10B981]/30">
            <p className="text-2xl font-bold text-[#10B981]">{activeCount}</p>
            <p className="text-xs text-white/60 mt-0.5">Active</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-3 text-center border border-white/10">
            <p className="text-2xl font-bold text-white/50">{idleCount}</p>
            <p className="text-xs text-white/60 mt-0.5">Idle</p>
          </div>
        </div>
      </div>

      <div className="px-6 mt-6 space-y-3">
        {/* Privacy note */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-[#10B981]/10 to-[#14B8A6]/10 rounded-2xl p-4 border border-[#10B981]/20 flex items-start gap-3"
        >
          <CheckCircle className="w-5 h-5 text-[#10B981] flex-shrink-0 mt-0.5" />
          <p className="text-[#0F172A] text-xs">All agents operate fully on-device. No data, camera feeds, voice, or location are sent to external servers.</p>
        </motion.div>

        {/* Agent cards */}
        {AGENT_DEFINITIONS.map((agent, i) => {
          const Icon = agent.icon;
          const agentState = state.agents?.[agent.id];
          const status = statusFromAgent(agentState);
          const isOpen = expandedAgent === agent.id;

          return (
            <motion.div key={agent.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="bg-white/80 rounded-2xl shadow-md border border-[#0F172A]/5 overflow-hidden"
            >
              <button onClick={() => setExpandedAgent(isOpen ? null : agent.id)} className="w-full flex items-center gap-4 p-4 text-left">
                <div className={`w-12 h-12 bg-gradient-to-r ${agent.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-[#0F172A] text-sm">{agent.label}</span>
                    <StatusDot status={status} />
                  </div>
                  <p className="text-[#475569] text-xs truncate">{agent.desc}</p>
                </div>
                <span className="text-[#94A3B8] text-lg ml-2">{isOpen ? '−' : '+'}</span>
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="px-4 pb-4 space-y-3 border-t border-[#0F172A]/5 pt-3">
                      <div>
                        <p className="text-xs font-semibold text-[#475569] mb-2 uppercase tracking-wide">Capabilities</p>
                        <div className="flex flex-wrap gap-2">
                          {agent.capabilities.map((cap) => (
                            <span key={cap} className="text-xs bg-[#F1F5F9] text-[#0F172A] px-2.5 py-1 rounded-full border border-[#0F172A]/8 font-medium">{cap}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Clock className="w-3.5 h-3.5 text-[#94A3B8]" />
                        <span className="text-[#94A3B8]">Status: <span className={`font-medium ${status === 'active' ? 'text-[#10B981]' : status === 'loading' ? 'text-[#F59E0B]' : status === 'error' ? 'text-[#EF4444]' : 'text-[#64748B]'}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span></span>
                      </div>
                      {agentState?.lastActivity && (
                        <p className="text-xs text-[#94A3B8]">Last active: {new Date(agentState.lastActivity).toLocaleTimeString()}</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

        {/* Architecture note */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="bg-gradient-to-r from-[#0F172A] to-[#1E293B] rounded-2xl p-5 border border-white/10 shadow-lg"
        >
          <h3 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#14B8A6]" />Multi-Agent Architecture
          </h3>
          <p className="text-white/60 text-xs leading-relaxed">Agents operate concurrently, sharing context through the local state store. No cloud APIs involved — all inference runs in your browser via WebGPU and WASM backends.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            {['@huggingface/transformers', 'WebGPU / WASM', 'Local Vector Store', 'IndexedDB Cache'].map((tech) => (
              <div key={tech} className="flex items-center gap-1.5 text-white/50">
                <span className="w-1.5 h-1.5 rounded-full bg-[#14B8A6]" />
                {tech}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
