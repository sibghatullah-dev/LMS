import type { Config } from 'tailwindcss';

/**
 * Design system tokens (UI/UX Design Specification §2).
 * Colors §2.2, typography §2.3, spacing/radius §2.4.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 900: '#14213D' },
        paper: { 50: '#F7F8FA' },
        surface: { 0: '#FFFFFF' },
        // Semantic accents — used deliberately per §2.2
        'accent-progress': '#FFB238', // marigold: progress, badges, points
        'accent-live': '#17B890', // teal: live/success/active
        'accent-alert': '#E85D4E', // coral: overdue/destructive/errors
        neutral: { 200: '#E5E7EB', 600: '#6B7280' },
        'focus-ring': '#3B82F6',
      },
      fontFamily: {
        display: ['var(--font-space-grotesk)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-plex-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Type scale (base 16) §2.3: 12 / 14 / 16 / 20 / 24 / 32 / 40
        caption: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.02em' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.25rem', { lineHeight: '1.75rem' }],
        xl: ['1.5rem', { lineHeight: '2rem' }],
        '2xl': ['2rem', { lineHeight: '2.5rem' }],
        '3xl': ['2.5rem', { lineHeight: '3rem' }],
      },
      borderRadius: {
        // §2.4: 12px card radius (soft, not pill)
        card: '12px',
      },
      spacing: {
        // §2.4: sidebar 260px desktop / 72px icon rail
        sidebar: '260px',
        rail: '72px',
      },
      maxWidth: {
        content: '1280px',
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
