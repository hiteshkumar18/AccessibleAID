import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';

const STORAGE_KEY = 'accessibleaid:prefs:v1';
const FIRST_RUN_KEY = 'accessibleaid:firstRunDone';

const initialState = {
  mode: 'home', // 'home' | 'sight' | 'caption' | 'simplify'
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  // Loading registry: { [key]: { loading, progress, label } }
  loaders: {},
  // Whether models for a given mode have ever been loaded
  modelsReady: { sight: false, caption: false, simplify: false },
  // Live announcement (mirrored to ARIA live region)
  announcement: '',
  showOnboarding: false,
  showHowItWorks: false,
  showSettings: false,
  // Cross-mode shared "memory" so e.g. Simplify can answer questions about
  // the OCR text or scene description from Sight without re-uploading.
  memory: {
    lastSceneDescription: '',
    lastOcrText: '',
    lastSimplified: '',
    lastTranscript: '',
  },
  // Persisted preferences
  prefs: {
    fontScale: 1,
    speechRate: 1,
    speechPitch: 1,
    speechVoiceURI: null,
    highContrast: false,
    autoSpeak: true,
    voiceOnly: false, // hides visuals, narrates everything aggressively
    backend: 'auto', // 'auto' | 'webgpu' | 'wasm'
  },
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_MODE':
      return { ...state, mode: action.mode };
    case 'SET_ONLINE':
      return { ...state, online: action.online };
    case 'SET_LOADER':
      return {
        ...state,
        loaders: { ...state.loaders, [action.key]: action.value },
      };
    case 'CLEAR_LOADER': {
      const next = { ...state.loaders };
      delete next[action.key];
      return { ...state, loaders: next };
    }
    case 'SET_MODELS_READY':
      return {
        ...state,
        modelsReady: { ...state.modelsReady, [action.mode]: action.ready },
      };
    case 'ANNOUNCE':
      return { ...state, announcement: action.text };
    case 'SHOW_ONBOARDING':
      return { ...state, showOnboarding: action.show };
    case 'SHOW_HOW':
      return { ...state, showHowItWorks: action.show };
    case 'SHOW_SETTINGS':
      return { ...state, showSettings: action.show };
    case 'UPDATE_PREFS':
      return { ...state, prefs: { ...state.prefs, ...action.patch } };
    case 'HYDRATE_PREFS':
      return { ...state, prefs: { ...state.prefs, ...action.prefs } };
    case 'REMEMBER':
      return { ...state, memory: { ...state.memory, ...action.patch } };
    default:
      return state;
  }
}

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Hydrate prefs + first-run check
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        dispatch({ type: 'HYDRATE_PREFS', prefs: parsed });
      }
    } catch (_) {
      /* ignore */
    }
    const seen = localStorage.getItem(FIRST_RUN_KEY);
    if (!seen) {
      dispatch({ type: 'SHOW_ONBOARDING', show: true });
    }
  }, []);

  // Persist prefs
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.prefs));
    } catch (_) {
      /* ignore */
    }
  }, [state.prefs]);

  // Apply font scale + contrast + voice-only flag to <html>
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.fontScale = String(state.prefs.fontScale);
    if (state.prefs.highContrast) html.classList.add('a11y-contrast');
    else html.classList.remove('a11y-contrast');
    if (state.prefs.voiceOnly) html.classList.add('a11y-voice-only');
    else html.classList.remove('a11y-voice-only');
  }, [state.prefs.fontScale, state.prefs.highContrast, state.prefs.voiceOnly]);

  // Online/offline
  useEffect(() => {
    const onOnline = () => dispatch({ type: 'SET_ONLINE', online: true });
    const onOffline = () => dispatch({ type: 'SET_ONLINE', online: false });
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const api = useMemo(
    () => ({
      state,
      dispatch,
      setMode: (mode) => dispatch({ type: 'SET_MODE', mode }),
      announce: (text) => dispatch({ type: 'ANNOUNCE', text }),
      updatePrefs: (patch) => dispatch({ type: 'UPDATE_PREFS', patch }),
      finishOnboarding: () => {
        localStorage.setItem(FIRST_RUN_KEY, '1');
        dispatch({ type: 'SHOW_ONBOARDING', show: false });
      },
      openHow: () => dispatch({ type: 'SHOW_HOW', show: true }),
      closeHow: () => dispatch({ type: 'SHOW_HOW', show: false }),
      openSettings: () => dispatch({ type: 'SHOW_SETTINGS', show: true }),
      closeSettings: () => dispatch({ type: 'SHOW_SETTINGS', show: false }),
      setLoader: (key, value) =>
        dispatch({ type: 'SET_LOADER', key, value }),
      clearLoader: (key) => dispatch({ type: 'CLEAR_LOADER', key }),
      setModelsReady: (mode, ready) =>
        dispatch({ type: 'SET_MODELS_READY', mode, ready }),
      remember: (patch) => dispatch({ type: 'REMEMBER', patch }),
    }),
    [state]
  );

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
