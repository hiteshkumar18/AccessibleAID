/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Legacy AccessibleAID tokens (keep for compatibility)
        primary: '#1a56db',
        success: '#057a55',
        warning: '#c27803',
        danger: '#c81e1e',
        bg: '#f9fafb',
        ink: '#111928',
        surface: '#ffffff',
        // Lumyn design system
        lumyn: {
          blue: '#3B82F6',
          teal: '#14B8A6',
          emerald: '#10B981',
          slate: '#0F172A',
          muted: '#475569',
          light: '#F8FAFC',
          card: '#EFF6FF',
          mint: '#F0FDFA',
        },
      },
      fontFamily: {
        sf: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        body: ['18px', { lineHeight: '1.6' }],
        output: ['24px', { lineHeight: '1.5' }],
      },
      minHeight: {
        touch: '48px',
      },
      minWidth: {
        touch: '48px',
      },
      backgroundImage: {
        'lumyn-gradient': 'linear-gradient(135deg, #3B82F6 0%, #14B8A6 50%, #10B981 100%)',
        'lumyn-subtle': 'linear-gradient(135deg, #EFF6FF 0%, #F0FDFA 100%)',
        'emergency-gradient': 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
      },
      keyframes: {
        flash: {
          '0%, 100%': { backgroundColor: 'rgba(220, 38, 38, 0)' },
          '50%': { backgroundColor: 'rgba(220, 38, 38, 0.6)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(59,130,246,0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(59,130,246,0.7)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        flash: 'flash 0.5s ease-in-out 3',
        'pulse-soft': 'pulse-soft 1.6s ease-in-out infinite',
        'scan-line': 'scan-line 2s linear infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      backdropBlur: {
        '4xl': '72px',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
    },
  },
  plugins: [],
};
