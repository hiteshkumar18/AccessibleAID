import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useLumyn } from './context/LumynContext.jsx';

// Lazy-load every screen so the initial bundle stays small.
// This is critical for PWA performance — users land on Splash instantly
// while all other screen bundles load in the background.
const Splash            = lazy(() => import('./screens/Splash.jsx'));
const Onboarding        = lazy(() => import('./screens/Onboarding.jsx'));
const AccessibilityProfile = lazy(() => import('./screens/AccessibilityProfile.jsx'));
const Home              = lazy(() => import('./screens/Home.jsx'));
const WorldUnderstanding = lazy(() => import('./screens/WorldUnderstanding.jsx'));
const SceneCamera       = lazy(() => import('./screens/SceneCamera.jsx'));
const LiveCaptioning    = lazy(() => import('./screens/LiveCaptioning.jsx'));
const SignLanguage       = lazy(() => import('./screens/SignLanguage.jsx'));
const Navigation        = lazy(() => import('./screens/Navigation.jsx'));
const EmergencySelector = lazy(() => import('./screens/EmergencySelector.jsx'));
const EmergencyCamera   = lazy(() => import('./screens/EmergencyCamera.jsx'));
const PanicReduction    = lazy(() => import('./screens/PanicReduction.jsx'));
const FamilySafety      = lazy(() => import('./screens/FamilySafety.jsx'));
const OfflineMode       = lazy(() => import('./screens/OfflineMode.jsx'));
const MedicalAssistant  = lazy(() => import('./screens/MedicalAssistant.jsx'));
const AIOrchestration   = lazy(() => import('./screens/AIOrchestration.jsx'));

function ScreenFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8FAFC] via-[#EFF6FF] to-[#F0FDFA] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-[#3B82F6]/30 border-t-[#3B82F6] animate-spin" />
        <p className="text-[#475569] text-sm font-medium">Loading…</p>
      </div>
    </div>
  );
}

export default function App() {
  const { state } = useLumyn();

  return (
    <>
      {/* Global ARIA live region for screen-reader announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {state.announcement}
      </div>

      {/* Skip link */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <main id="main-content">
        <Suspense fallback={<ScreenFallback />}>
          <Routes>
            <Route path="/"                     element={<Splash />} />
            <Route path="/onboarding"           element={<Onboarding />} />
            <Route path="/accessibility-profile" element={<AccessibilityProfile />} />
            <Route path="/home"                 element={<Home />} />
            <Route path="/world-understanding"  element={<WorldUnderstanding />} />
            <Route path="/scene-camera"         element={<SceneCamera />} />
            <Route path="/live-captioning"      element={<LiveCaptioning />} />
            <Route path="/sign-language"        element={<SignLanguage />} />
            <Route path="/navigation"           element={<Navigation />} />
            <Route path="/emergency"            element={<EmergencySelector />} />
            <Route path="/emergency-camera"     element={<EmergencyCamera />} />
            <Route path="/panic-reduction"      element={<PanicReduction />} />
            <Route path="/family-safety"        element={<FamilySafety />} />
            <Route path="/offline"              element={<OfflineMode />} />
            <Route path="/medical"              element={<MedicalAssistant />} />
            <Route path="/ai-orchestration"     element={<AIOrchestration />} />
            {/* Fallback */}
            <Route path="*"                     element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </>
  );
}
