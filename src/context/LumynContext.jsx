import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';

const PREFS_KEY = 'lumyn:prefs:v2';
const PROFILE_KEY = 'lumyn:profile:v1';
const FIRST_RUN_KEY = 'lumyn:firstRunDone';

const initialState = {
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  loaders: {},
  modelsReady: {
    sceneUnderstanding: false,
    liveCaptions: false,
    textSimplify: false,
    medicalRAG: false,
    objectDetection: false,
    depthEstimation: false,
    soundClassification: false,
  },
  announcement: '',
  showOnboarding: false,
  showSettings: false,
  showProfile: false,
  memory: {
    lastSceneDescription: '',
    lastOcrText: '',
    lastSimplified: '',
    lastTranscript: '',
    lastHazards: [],
    environmentContext: '',
    lastNavigationRoute: null,
  },
  emergency: {
    active: false,
    type: null,
    hazards: [],
    evacuationPath: [],
    nearestShelter: null,
    alertSent: false,
  },
  panicMode: false,
  cognitiveLoad: 'normal',
  profile: {
    name: '',
    disabilities: [],
    preferredComm: 'voice',
    wheelchairUser: false,
    assistiveTech: [],
    emergencyContacts: [],
    medicalInfo: '',
    onboardingDone: false,
  },
  privacy: {
    cameraProcessingLocal: true,
    audioProcessingLocal: true,
    locationShared: false,
    cloudFallbackAllowed: false,
    lastProcessingMode: 'on-device',
  },
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
  family: {
    members: [],
    groupLocation: null,
    regroupPoint: null,
    emergencyBroadcast: null,
  },
  prefs: {
    fontScale: 1,
    speechRate: 1,
    speechPitch: 1,
    speechVoiceURI: null,
    highContrast: false,
    autoSpeak: true,
    voiceOnly: false,
    reducedMotion: false,
    backend: 'auto',
    hapticFeedback: true,
    largeText: false,
    colorBlindMode: 'none',
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

function initializeState() {
  const s = { ...initialState };
  try {
    const rawPrefs = localStorage.getItem(PREFS_KEY);
    if (rawPrefs) s.prefs = { ...s.prefs, ...JSON.parse(rawPrefs) };
    const rawProfile = localStorage.getItem(PROFILE_KEY);
    if (rawProfile) s.profile = { ...s.profile, ...JSON.parse(rawProfile) };
    if (!localStorage.getItem(FIRST_RUN_KEY)) s.showOnboarding = true;
  } catch (_) {}
  return s;
}

export function LumynProvider({ children }) {
  // Use lazy initializer so hydration runs ONCE — immune to StrictMode double-effect
  const [state, dispatch] = useReducer(reducer, undefined, initializeState);

  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(state.prefs)); } catch (_) {}
  }, [state.prefs]);

  useEffect(() => {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(state.profile)); } catch (_) {}
  }, [state.profile]);

  useEffect(() => {
    const html = document.documentElement;
    html.dataset.fontScale = String(state.prefs.fontScale);
    html.classList.toggle('a11y-contrast', !!state.prefs.highContrast);
    html.classList.toggle('a11y-voice-only', !!state.prefs.voiceOnly);
    html.classList.toggle('a11y-large-text', !!state.prefs.largeText);
  }, [state.prefs.fontScale, state.prefs.highContrast, state.prefs.voiceOnly, state.prefs.largeText]);

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

  // Stable dispatch-based API — useCallback([dispatch]) never changes because
  // dispatch from useReducer is always the same reference across renders.
  const setLoader = useCallback((key, value) => dispatch({ type: 'SET_LOADER', key, value }), [dispatch]);
  const clearLoader = useCallback((key) => dispatch({ type: 'CLEAR_LOADER', key }), [dispatch]);
  const setModelReady = useCallback((model, ready) => dispatch({ type: 'SET_MODEL_READY', model, ready }), [dispatch]);
  const announce = useCallback((text) => dispatch({ type: 'ANNOUNCE', text }), [dispatch]);
  const updatePrefs = useCallback((patch) => dispatch({ type: 'UPDATE_PREFS', patch }), [dispatch]);
  const remember = useCallback((patch) => dispatch({ type: 'REMEMBER', patch }), [dispatch]);
  const updateProfile = useCallback((patch) => dispatch({ type: 'UPDATE_PROFILE', patch }), [dispatch]);
  const finishOnboarding = useCallback(() => {
    localStorage.setItem(FIRST_RUN_KEY, '1');
    dispatch({ type: 'SHOW_ONBOARDING', show: false });
    dispatch({ type: 'UPDATE_PROFILE', patch: { onboardingDone: true } });
  }, [dispatch]);
  const activateEmergency = useCallback((type) => dispatch({ type: 'SET_EMERGENCY', patch: { active: true, type } }), [dispatch]);
  const updateEmergency = useCallback((patch) => dispatch({ type: 'SET_EMERGENCY', patch }), [dispatch]);
  const clearEmergency = useCallback(() => dispatch({ type: 'CLEAR_EMERGENCY' }), [dispatch]);
  const setPanicMode = useCallback((active) => dispatch({ type: 'SET_PANIC_MODE', active }), [dispatch]);
  const updatePrivacy = useCallback((patch) => dispatch({ type: 'UPDATE_PRIVACY', patch }), [dispatch]);
  const setAgentStatus = useCallback((agent, status) => dispatch({ type: 'SET_AGENT_STATUS', agent, status }), [dispatch]);
  const updateFamily = useCallback((patch) => dispatch({ type: 'UPDATE_FAMILY', patch }), [dispatch]);

  // Only `state` changes trigger re-renders of consumers; all functions are stable.
  const value = useMemo(() => ({
    state,
    dispatch,
    setLoader,
    clearLoader,
    setModelReady,
    announce,
    updatePrefs,
    remember,
    updateProfile,
    finishOnboarding,
    activateEmergency,
    updateEmergency,
    clearEmergency,
    setPanicMode,
    updatePrivacy,
    setAgentStatus,
    updateFamily,
  }), [
    state,
    setLoader, clearLoader, setModelReady,
    announce, updatePrefs, remember, updateProfile, finishOnboarding,
    activateEmergency, updateEmergency, clearEmergency,
    setPanicMode, updatePrivacy, setAgentStatus, updateFamily,
  ]);

  return <LumynContext.Provider value={value}>{children}</LumynContext.Provider>;
}

export function useLumyn() {
  const ctx = useContext(LumynContext);
  if (!ctx) throw new Error('useLumyn must be used within LumynProvider');
  return ctx;
}

export function useApp() {
  return useLumyn();
}
