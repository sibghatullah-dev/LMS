import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 900: '#0F172A', 800: '#1E293B', 700: '#334155' },
        paper: { 50: '#F8FAFC', 100: '#F1F5F9' },
        surface: { 0: '#FFFFFF' },
        'surface-soft': '#EEF4FF',
        'accent-progress': '#D97706',
        'accent-live': '#059669',
        'accent-alert': '#DC2626',
        neutral: { 100: '#F1F5F9', 200: '#E2E8F0', 300: '#CBD5E1', 500: '#64748B', 600: '#475569' },
        'focus-ring': '#3B82F6',
      },
      fontFamily: {
        display: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        caption: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.02em' }],
        sm: ['0.8125rem', { lineHeight: '1.125rem' }],
        base: ['0.875rem', { lineHeight: '1.25rem' }],
        lg: ['1rem', { lineHeight: '1.5rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.375rem' }],
      },
      borderRadius: {
        card: '8px',
      },
      spacing: {
        sidebar: '240px',
        rail: '64px',
      },
      maxWidth: {
        content: '1440px',
      },
      keyframes: {
        'ring-fill': {
          from: { strokeDashoffset: 'var(--ring-circumference)' },
          to: { strokeDashoffset: 'var(--ring-offset)' },
        },
        'live-pulse': {
          '0%, 100%': { opacity: '0.85' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        // §2.6: exactly two motions, both gated by prefers-reduced-motion in CSS
        'ring-fill': 'ring-fill 600ms ease-out',
        'live-pulse': 'live-pulse 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
