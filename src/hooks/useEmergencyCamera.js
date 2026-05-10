import { useCallback, useRef, useState } from 'react';
import { useModelLoader } from './useModelLoader.js';
import { useLumyn } from '../context/LumynContext.jsx';
import { captureFrameToDataURL } from '../utils/imageUtils.js';
import { vibrate } from '../utils/haptics.js';

import { MODELS } from '../config/models.js';

const DETECTION_MODEL = MODELS.DETECTION.id;

// Only COCO-80 labels that YOLOS/DETR can actually output
const EMERGENCY_HAZARD_MAP = {
  // Critical — large fast-moving vehicles
  car:          { severity: 'critical', icon: '🚗', label: 'Vehicle', color: 'red' },
  truck:        { severity: 'critical', icon: '🚛', label: 'Large Vehicle', color: 'red' },
  bus:          { severity: 'critical', icon: '🚌', label: 'Bus', color: 'red' },
  train:        { severity: 'critical', icon: '🚂', label: 'Train', color: 'red' },
  // High — weapons
  knife:        { severity: 'high', icon: '🔪', label: 'Knife Visible', color: 'orange' },
  scissors:     { severity: 'high', icon: '✂️', label: 'Sharp Object', color: 'orange' },
  // Medium — smaller vehicles
  motorcycle:   { severity: 'high', icon: '🏍️', label: 'Motorcycle', color: 'orange' },
  bicycle:      { severity: 'medium', icon: '🚲', label: 'Bicycle', color: 'yellow' },
  // Low — obstacles / trip hazards
  person:       { severity: 'low', icon: '👤', label: 'Person', color: 'blue' },
  chair:        { severity: 'low', icon: '🪑', label: 'Chair Obstacle', color: 'yellow' },
  'dining table': { severity: 'low', icon: '🪑', label: 'Table Obstacle', color: 'yellow' },
  bench:        { severity: 'low', icon: '🪑', label: 'Bench', color: 'yellow' },
  suitcase:     { severity: 'low', icon: '🧳', label: 'Luggage', color: 'yellow' },
  skateboard:   { severity: 'low', icon: '🛹', label: 'Skateboard', color: 'yellow' },
  bottle:       { severity: 'low', icon: '🧴', label: 'Debris', color: 'yellow' },
};

function generateEvacuationPath(hazards, frameWidth = 640, frameHeight = 480) {
  // Build a simplified escape route avoiding detected hazard bounding boxes.
  // In production this would use pathfinding (A*, NavMesh) with real geometry.
  const dangerZones = hazards
    .filter((h) => h.severity === 'critical' || h.severity === 'high')
    .map((h) => h.box);

  const startX = 50;
  const startY = 90;
  const exitX = 10;
  const exitY = 10;

  // Simple waypoints that route around the first danger zone if present
  const waypoints = [{ x: startX, y: startY }];

  if (dangerZones.length > 0) {
    const dz = dangerZones[0];
    const dzCenterX = ((dz.xmin + dz.xmax) / 2 / frameWidth) * 100;
    // Route around the danger zone
    if (dzCenterX > 50) {
      waypoints.push({ x: 30, y: 70 }, { x: 20, y: 50 }, { x: 15, y: 30 });
    } else {
      waypoints.push({ x: 70, y: 70 }, { x: 75, y: 50 }, { x: 70, y: 30 });
    }
  } else {
    waypoints.push({ x: 40, y: 70 }, { x: 30, y: 50 }, { x: 20, y: 30 });
  }

  waypoints.push({ x: exitX, y: exitY });
  return waypoints;
}

function generateNavigationSteps(hazards, evacuationPath) {
  const steps = [];
  if (hazards.some((h) => h.severity === 'critical')) {
    steps.push('Evacuate immediately — critical hazard detected');
  }
  steps.push('Follow the highlighted cyan path');
  if (hazards.some((h) => h.label === 'smoke' || h.label === 'fire')) {
    steps.push('Stay low — avoid smoke inhalation');
  }
  steps.push('Move toward the nearest exit (green markers)');
  if (hazards.some((h) => h.label === 'stairs')) {
    steps.push('Stairs detected — use accessible elevator if available');
  }
  steps.push('Exit the building and move upwind');
  return steps;
}

export function useEmergencyCamera() {
  const { loadPipeline } = useModelLoader();
  const { remember, announce, activateEmergency, updateEmergency, setAgentStatus } = useLumyn();

  const detectionPipeRef = useRef(null);
  const scanIntervalRef = useRef(null);

  const [state, setState] = useState({
    scanning: false,
    hazards: [],
    evacuationPath: [],
    navigationSteps: [],
    threatLevel: 'none', // 'none' | 'low' | 'medium' | 'high' | 'critical'
    accessibleExitFound: false,
    error: null,
    frameCount: 0,
  });

  const analyzeForEmergency = useCallback(
    async (imageSource) => {
      setAgentStatus('emergency', 'active');

      try {
        if (!detectionPipeRef.current) {
          detectionPipeRef.current = await loadPipeline(
            'object-detection',
            DETECTION_MODEL,
            { dtype: MODELS.DETECTION.dtype }
          );
        }

        const rawDetections = await detectionPipeRef.current(imageSource, {
          threshold: 0.50,
        });

        const hazards = (Array.isArray(rawDetections) ? rawDetections : [])
          .filter((d) => EMERGENCY_HAZARD_MAP[d.label?.toLowerCase()])
          .map((d) => {
            const meta = EMERGENCY_HAZARD_MAP[d.label.toLowerCase()];
            return {
              id: `${d.label}-${Math.round(d.score * 1000)}`,
              label: meta.label,
              rawLabel: d.label,
              severity: meta.severity,
              icon: meta.icon,
              color: meta.color,
              score: d.score,
              box: d.box,
              position: {
                x: ((d.box.xmin + d.box.xmax) / 2 / 640) * 100,
                y: ((d.box.ymin + d.box.ymax) / 2 / 480) * 100,
              },
            };
          });

        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1, none: 0 };
        const maxSeverity = hazards.reduce((max, h) => {
          return severityOrder[h.severity] > severityOrder[max] ? h.severity : max;
        }, 'none');

        const evacuationPath = generateEvacuationPath(hazards);
        const navigationSteps = generateNavigationSteps(hazards, evacuationPath);

        setState((s) => ({
          ...s,
          hazards,
          evacuationPath,
          navigationSteps,
          threatLevel: maxSeverity,
          accessibleExitFound: true,
          frameCount: s.frameCount + 1,
        }));

        if (maxSeverity === 'critical') {
          activateEmergency('environmental');
          updateEmergency({ hazards, evacuationPath });
          vibrate('emergency');
          announce('Critical hazard detected. Follow evacuation path now.');
        }

        remember({ lastHazards: hazards });
        return { hazards, evacuationPath, navigationSteps, threatLevel: maxSeverity };
      } catch (err) {
        setState((s) => ({ ...s, error: err?.message || 'Analysis failed.' }));
        return null;
      } finally {
        setAgentStatus('emergency', 'idle');
      }
    },
    [loadPipeline, remember, announce, activateEmergency, updateEmergency, setAgentStatus]
  );

  const startContinuousScan = useCallback(
    (videoElement, intervalMs = 2000) => {
      if (scanIntervalRef.current) return;
      setState((s) => ({ ...s, scanning: true }));

      const scan = async () => {
        const dataUrl = captureFrameToDataURL(videoElement, 640);
        if (dataUrl) await analyzeForEmergency(dataUrl);
      };

      scan(); // immediate first scan
      scanIntervalRef.current = setInterval(scan, intervalMs);
    },
    [analyzeForEmergency]
  );

  const stopContinuousScan = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setState((s) => ({ ...s, scanning: false }));
  }, []);

  return {
    ...state,
    analyzeForEmergency,
    startContinuousScan,
    stopContinuousScan,
  };
}
