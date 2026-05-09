export const BrainAccessibilityIcon = ({ className = 'w-6 h-6' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <defs>
      <linearGradient id="brain-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3B82F6" />
        <stop offset="100%" stopColor="#14B8A6" />
      </linearGradient>
    </defs>
    <path
      d="M12 2C9.5 2 7.5 3.5 7 5.5C5.5 5.5 4 7 4 8.5C4 10 5.5 11.5 7 11.5C7 13.5 8 15 9.5 16C10 17 10.5 18 11 19.5C11.5 21 12 22 12 22C12 22 12.5 21 13 19.5C13.5 18 14 17 14.5 16C16 15 17 13.5 17 11.5C18.5 11.5 20 10 20 8.5C20 7 18.5 5.5 17 5.5C16.5 3.5 14.5 2 12 2Z"
      fill="url(#brain-grad)" opacity="0.9"
    />
    <circle cx="9" cy="9" r="1.5" fill="white" opacity="0.8" />
    <circle cx="15" cy="9" r="1.5" fill="white" opacity="0.8" />
    <path d="M9 13 Q12 15 15 13" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.7" />
  </svg>
);

export const WorldEyeIcon = ({ className = 'w-6 h-6' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <defs>
      <linearGradient id="world-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#10B981" />
        <stop offset="100%" stopColor="#3B82F6" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="9" stroke="url(#world-grad)" strokeWidth="2" fill="none" opacity="0.9" />
    <ellipse cx="12" cy="12" rx="4" ry="9" stroke="url(#world-grad)" strokeWidth="1.5" fill="none" opacity="0.6" />
    <path d="M3 12h18M12 3c2 3 2 6 2 9s0 6-2 9M12 3c-2 3-2 6-2 9s0 6 2 9" stroke="url(#world-grad)" strokeWidth="1.5" fill="none" opacity="0.7" />
    <circle cx="12" cy="12" r="3" fill="url(#world-grad)" opacity="0.8" />
  </svg>
);

export const EmergencyShieldIcon = ({ className = 'w-6 h-6' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <defs>
      <linearGradient id="emergency-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#EF4444" />
      </linearGradient>
    </defs>
    <path d="M12 2L4 6v5c0 5 3 9.5 8 11 5-1.5 8-6 8-11V6l-8-4z" fill="url(#emergency-grad)" opacity="0.9" />
    <path d="M12 8v5M12 16h.01" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.95" />
  </svg>
);

export const NavigationCompassIcon = ({ className = 'w-6 h-6' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <defs>
      <linearGradient id="nav-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3B82F6" />
        <stop offset="100%" stopColor="#10B981" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="9" stroke="url(#nav-grad)" strokeWidth="2" fill="none" opacity="0.8" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2" stroke="url(#nav-grad)" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    <path d="M8 8l6 2 2 6-6-2-2-6z" fill="url(#nav-grad)" opacity="0.9" />
  </svg>
);

export const CaptionBubbleIcon = ({ className = 'w-6 h-6' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <defs>
      <linearGradient id="caption-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#14B8A6" />
        <stop offset="100%" stopColor="#3B82F6" />
      </linearGradient>
    </defs>
    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V6c0-1.1-.9-2-2-2z" fill="url(#caption-grad)" opacity="0.9" />
    <path d="M7 10h2M7 14h10M11 10h6" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
  </svg>
);

export const SignHandIcon = ({ className = 'w-6 h-6' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <defs>
      <linearGradient id="sign-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#10B981" />
        <stop offset="100%" stopColor="#14B8A6" />
      </linearGradient>
    </defs>
    <path
      d="M13 2v7h2V3c0-.6.4-1 1-1s1 .4 1 1v6h2V4c0-.6.4-1 1-1s1 .4 1 1v10c0 3.9-3.1 7-7 7H9c-3.9 0-7-3.1-7-7v-3c0-.6.4-1 1-1s1 .4 1 1v3h2V6c0-.6.4-1 1-1s1 .4 1 1v8h2V3c0-.6.4-1 1-1s1 .4 1 1v6h2z"
      fill="url(#sign-grad)" opacity="0.9"
    />
  </svg>
);

export const FamilyGroupIcon = ({ className = 'w-6 h-6' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <defs>
      <linearGradient id="family-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3B82F6" />
        <stop offset="100%" stopColor="#10B981" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="6" r="3" fill="url(#family-grad)" opacity="0.9" />
    <circle cx="6" cy="10" r="2.5" fill="url(#family-grad)" opacity="0.7" />
    <circle cx="18" cy="10" r="2.5" fill="url(#family-grad)" opacity="0.7" />
    <path
      d="M12 11c-2.5 0-4.5 1.5-5 3.5v4.5h10v-4.5c-.5-2-2.5-3.5-5-3.5zM6 14c-1.5 0-2.5 1-3 2v3h3v-5zM18 14c1.5 0 2.5 1 3 2v3h-3v-5z"
      fill="url(#family-grad)" opacity="0.8"
    />
  </svg>
);

export const MedicalPulseIcon = ({ className = 'w-6 h-6' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <defs>
      <linearGradient id="medical-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#EF4444" />
        <stop offset="100%" stopColor="#F59E0B" />
      </linearGradient>
    </defs>
    <path d="M2 12h4l2-4 4 8 2-4h8" stroke="url(#medical-grad)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
    <circle cx="12" cy="12" r="9" stroke="url(#medical-grad)" strokeWidth="2" fill="none" opacity="0.6" />
  </svg>
);

export const AIAgentIcon = ({ className = 'w-6 h-6' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <defs>
      <linearGradient id="ai-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3B82F6" />
        <stop offset="50%" stopColor="#14B8A6" />
        <stop offset="100%" stopColor="#10B981" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="3" fill="url(#ai-grad)" opacity="0.9" />
    <circle cx="6" cy="6" r="2" fill="url(#ai-grad)" opacity="0.7" />
    <circle cx="18" cy="6" r="2" fill="url(#ai-grad)" opacity="0.7" />
    <circle cx="6" cy="18" r="2" fill="url(#ai-grad)" opacity="0.7" />
    <circle cx="18" cy="18" r="2" fill="url(#ai-grad)" opacity="0.7" />
    <path d="M12 9L6 6M12 9l6-3M12 15l-6 3M12 15l6 3M9 12H6M18 12h-3" stroke="url(#ai-grad)" strokeWidth="1.5" opacity="0.6" />
  </svg>
);

export const LumynLogoIcon = ({ className = 'w-12 h-12' }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none">
    <defs>
      <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3B82F6" />
        <stop offset="50%" stopColor="#14B8A6" />
        <stop offset="100%" stopColor="#10B981" />
      </linearGradient>
      <filter id="logo-glow">
        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
        <feMerge>
          <feMergeNode in="coloredBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <circle cx="24" cy="24" r="20" fill="url(#logo-grad)" opacity="0.2" />
    <circle cx="24" cy="24" r="16" stroke="url(#logo-grad)" strokeWidth="2" fill="none" filter="url(#logo-glow)" />
    <circle cx="24" cy="24" r="8" fill="url(#logo-grad)" filter="url(#logo-glow)" />
    <circle cx="16" cy="16" r="2" fill="url(#logo-grad)" opacity="0.8" />
    <circle cx="32" cy="16" r="2" fill="url(#logo-grad)" opacity="0.8" />
    <circle cx="16" cy="32" r="2" fill="url(#logo-grad)" opacity="0.8" />
    <circle cx="32" cy="32" r="2" fill="url(#logo-grad)" opacity="0.8" />
  </svg>
);

export const OfflineCloudIcon = ({ className = 'w-6 h-6' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <defs>
      <linearGradient id="offline-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#475569" />
        <stop offset="100%" stopColor="#3B82F6" />
      </linearGradient>
    </defs>
    <path
      d="M19 13c0-3.3-2.7-6-6-6-2.6 0-4.8 1.6-5.7 3.9C4.8 11.3 3 13.4 3 16c0 2.8 2.2 5 5 5h11c2.8 0 5-2.2 5-5 0-2.6-2-4.7-4.5-5z"
      fill="url(#offline-grad)" opacity="0.8"
    />
    <path d="M12 13v5M9 15l3-3 3 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
  </svg>
);

export const PanicHeartIcon = ({ className = 'w-6 h-6' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <defs>
      <linearGradient id="panic-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#14B8A6" />
        <stop offset="100%" stopColor="#10B981" />
      </linearGradient>
    </defs>
    <path
      d="M20.8 4.6c-1.5-1.5-4-1.5-5.5 0L12 8l-3.3-3.4c-1.5-1.5-4-1.5-5.5 0-1.5 1.5-1.5 4 0 5.5l8.8 9 8.8-9c1.5-1.5 1.5-4 0-5.5z"
      fill="url(#panic-grad)" opacity="0.9"
    />
    <path d="M8 11h2v2H8zM14 11h2v2h-2z" fill="white" opacity="0.9" />
  </svg>
);
