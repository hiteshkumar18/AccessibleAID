import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';

const PREFS_KEY = 'lumyn:prefs:v2';
const PROFILE_KEY = 'lumyn:profile:v1';
const FIRST_RUN_KEY = 'lumyn:firstRunDone';

const initialState = {
  // Online status
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,

  // Loading registry for AI models
  loaders: {},

  // Which AI models have been loaded
  modelsReady: {
    sceneUnderstanding: false,
    liveCaptions: false,
    textSimplify: false,
    medicalRAG: false,
    objectDetection: false,
    depthEstimation: false,
    soundClassification: false,
  },

  // ARIA live announcements
  announcement: '',

  // Modal state
  showOnboarding: false,
  showSettings: false,
  showProfile: false,

  // Cross-mode memory for context continuity
  memory: {
    lastSceneDescription: '',
    lastOcrText: '',
    lastSimplified: '',
    lastTranscript: '',
    lastHazards: [],
    environmentContext: '',
    lastNavigationRoute: null,
  },

  // Emergency state
  emergency: {
    active: false,
    type: null, // 'fire' | 'earthquake' | 'flood' | 'shooter' | 'medical' | null
    hazards: [],
    evacuationPath: [],
    nearestShelter: null,
    alertSent: false,
  },

  // Panic/cognitive state
  panicMode: false,
  cognitiveLoad: 'normal', // 'normal' | 'reduced' | 'minimal'

  // Accessibility profile
  profile: {
    name: '',
    disabilities: [], // 'visual' | 'hearing' | 'mobility' | 'cognitive' | 'speech'
    preferredComm: 'voice', // 'voice' | 'text' | 'haptic'
    wheelchairUser: false,
    assistiveTech: [], // 'screen-reader' | 'hearing-aid' | 'cane' | 'prosthetic'
    emergencyContacts: [],
    medicalInfo: '',
    onboardingDone: false,
  },

  // Privacy state — all processing is local by default
  privacy: {
    cameraProcessingLocal: true,
    audioProcessingLocal: true,
    locationShared: false,
    cloudFallbackAllowed: false,
    lastProcessingMode: 'on-device', // 'on-device' | 'offline' | 'cloud-fallback'
  },

  // AI agent status
  agents: {
    navigation: 'idle',
    accessibility: 'idle',
    emergency: 'idle',
    environmental: 'idle',
    memory: 'idle',
    medical: 'idle',
    social: 'idle',
    cognitive: 'idle',
  },

  // Family safety
  family: {
    members: [],
    groupLocation: null,
    regroupPoint: null,
    emergencyBroadcast: null,
  },

  // Persisted user preferences
  prefs: {
    fontScale: 1,
    speechRate: 1,
    speechPitch: 1,
    speechVoiceURI: null,
    highContrast: false,
    autoSpeak: true,
    voiceOnly: false,
    reducedMotion: false,
    backend: 'auto', // 'auto' | 'webgpu' | 'wasm'
    hapticFeedback: true,
    largeText: false,
    colorBlindMode: 'none', // 'none' | 'deuteranopia' | 'protanopia' | 'tritanopia'
  },
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_ONLINE':
      return { ...state, online: action.online };

    case 'SET_LOADER':
      return { ...state, loaders: { ...state.loaders, [action.key]: action.value } };

    case 'CLEAR_LOADER': {
      const next = { ...state.loaders };
      delete next[action.key];
      return { ...state, loaders: next };
    }

    case 'SET_MODEL_READY':
      return {
        ...state,
        modelsReady: { ...state.modelsReady, [action.model]: action.ready },
      };

    case 'ANNOUNCE':
      return { ...state, announcement: action.text };

    case 'SHOW_ONBOARDING':
      return { ...state, showOnboarding: action.show };

    case 'SHOW_SETTINGS':
      return { ...state, showSettings: action.show };

    case 'SHOW_PROFILE':
      return { ...state, showProfile: action.show };

    case 'UPDATE_PREFS':
      return { ...state, prefs: { ...state.prefs, ...action.patch } };

    case 'HYDRATE_PREFS':
      return { ...state, prefs: { ...state.prefs, ...action.prefs } };

    case 'REMEMBER':
      return { ...state, memory: { ...state.memory, ...action.patch } };

    case 'UPDATE_PROFILE':
      return { ...state, profile: { ...state.profile, ...action.patch } };

    case 'HYDRATE_PROFILE':
      return { ...state, profile: { ...state.profile, ...action.profile } };

    case 'SET_EMERGENCY':
      return { ...state, emergency: { ...state.emergency, ...action.patch } };

    case 'CLEAR_EMERGENCY':
      return {
        ...state,
        emergency: {
          active: false,
          type: null,
          hazards: [],
          evacuationPath: [],
          nearestShelter: null,
          alertSent: false,
        },
      };

    case 'SET_PANIC_MODE':
      return {
        ...state,
        panicMode: action.active,
        cognitiveLoad: action.active ? 'minimal' : 'normal',
      };

    case 'SET_COGNITIVE_LOAD':
      return { ...state, cognitiveLoad: action.level };

    case 'UPDATE_PRIVACY':
      return { ...state, privacy: { ...state.privacy, ...action.patch } };

    case 'SET_AGENT_STATUS':
      return {
        ...state,
        agents: { ...state.agents, [action.agent]: action.status },
      };

    case 'UPDATE_FAMILY':
      return { ...state, family: { ...state.family, ...action.patch } };

    default:
      return state;
  }
}

const LumynContext = createContext(null);

export function LumynProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Hydrate preferences and profile from localStorage
  useEffect(() => {
    try {
      const rawPrefs = localStorage.getItem(PREFS_KEY);
      if (rawPrefs) {
        dispatch({ type: 'HYDRATE_PREFS', prefs: JSON.parse(rawPrefs) });
      }
      const rawProfile = localStorage.getItem(PROFILE_KEY);
      if (rawProfile) {
        dispatch({ type: 'HYDRATE_PROFILE', profile: JSON.parse(rawProfile) });
      }
    } catch (_) {}

    const seen = localStorage.getItem(FIRST_RUN_KEY);
    if (!seen) {
      dispatch({ type: 'SHOW_ONBOARDING', show: true });
    }
  }, []);

  // Persist prefs
  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(state.prefs));
    } catch (_) {}
  }, [state.prefs]);

  // Persist profile
  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(state.profile));
    } catch (_) {}
  }, [state.profile]);

  // Apply CSS classes driven by preferences
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.fontScale = String(state.prefs.fontScale);
    html.classList.toggle('a11y-contrast', !!state.prefs.highContrast);
    html.classList.toggle('a11y-voice-only', !!state.prefs.voiceOnly);
    html.classList.toggle('a11y-large-text', !!state.prefs.largeText);
  }, [state.prefs.fontScale, state.prefs.highContrast, state.prefs.voiceOnly, state.prefs.largeText]);

  // Online/offline tracking
  useEffect(() => {
    const up = () => dispatch({ type: 'SET_ONLINE', online: true });
    const down = () => dispatch({ type: 'SET_ONLINE', online: false });
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  const api = useMemo(
    () => ({
      state,
      dispatch,

      // Model loading
      setLoader: (key, value) => dispatch({ type: 'SET_LOADER', key, value }),
      clearLoader: (key) => dispatch({ type: 'CLEAR_LOADER', key }),
      setModelReady: (model, ready) => dispatch({ type: 'SET_MODEL_READY', model, ready }),

      // Announcements
      announce: (text) => dispatch({ type: 'ANNOUNCE', text }),

      // Preferences
      updatePrefs: (patch) => dispatch({ type: 'UPDATE_PREFS', patch }),

      // Memory
      remember: (patch) => dispatch({ type: 'REMEMBER', patch }),

      // Profile
      updateProfile: (patch) => dispatch({ type: 'UPDATE_PROFILE', patch }),
      finishOnboarding: () => {
        localStorage.setItem(FIRST_RUN_KEY, '1');
        dispatch({ type: 'SHOW_ONBOARDING', show: false });
        dispatch({ type: 'UPDATE_PROFILE', patch: { onboardingDone: true } });
      },

      // Emergency
      activateEmergency: (type) =>
        dispatch({ type: 'SET_EMERGENCY', patch: { active: true, type } }),
      updateEmergency: (patch) => dispatch({ type: 'SET_EMERGENCY', patch }),
      clearEmergency: () => dispatch({ type: 'CLEAR_EMERGENCY' }),

      // Panic mode
      setPanicMode: (active) => dispatch({ type: 'SET_PANIC_MODE', active }),

      // Privacy
      updatePrivacy: (patch) => dispatch({ type: 'UPDATE_PRIVACY', patch }),

      // Agents
      setAgentStatus: (agent, status) =>
        dispatch({ type: 'SET_AGENT_STATUS', agent, status }),

      // Family
      updateFamily: (patch) => dispatch({ type: 'UPDATE_FAMILY', patch }),
    }),
    [state]
  );

  return <LumynContext.Provider value={api}>{children}</LumynContext.Provider>;
}

export function useLumyn() {
  const ctx = useContext(LumynContext);
  if (!ctx) throw new Error('useLumyn must be used within LumynProvider');
  return ctx;
}

// Re-export useApp as an alias to useLumyn for backwards compat with existing hooks
export function useApp() {
  return useLumyn();
}
