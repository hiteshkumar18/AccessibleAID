/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1a56db',
        success: '#057a55',
        warning: '#c27803',
        danger: '#c81e1e',
        bg: '#f9fafb',
        ink: '#111928',
        surface: '#ffffff',
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
      keyframes: {
        flash: {
          '0%, 100%': { backgroundColor: 'rgba(220, 38, 38, 0)' },
          '50%': { backgroundColor: 'rgba(220, 38, 38, 0.6)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
      },
      animation: {
        flash: 'flash 0.5s ease-in-out 3',
        'pulse-soft': 'pulse-soft 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
