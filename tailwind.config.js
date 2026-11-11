/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        impulso: {
          night: '#0B1220',
          panel: '#101A2D',
          card: '#121D33',
          edge: 'rgba(148, 163, 184, 0.12)',
          mint: '#34D399',
          emerald: '#10B981',
          gold: '#F59E0B',
          rose: '#F43F5E',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(16, 185, 129, 0.35), 0 10px 34px -8px rgba(16, 185, 129, 0.35)',
        card: '0 10px 30px -12px rgba(2, 6, 23, 0.7)',
      },
      keyframes: {
        'slide-up': {
          from: { transform: 'translateY(24px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'scale-in': {
          from: { transform: 'scale(0.92)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'pin-drop': {
          '0%': { transform: 'translateY(-14px) scale(0.6)', opacity: '0' },
          '60%': { transform: 'translateY(3px) scale(1.06)', opacity: '1' },
          '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.35s cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scale-in 0.25s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.25s ease both',
        'pin-drop': 'pin-drop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        shimmer: 'shimmer 1.8s linear infinite',
        'pulse-soft': 'pulse-soft 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
