import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        body: ['"Manrope"', 'sans-serif'],
      },
      colors: {
        wayfarer: {
          primary: '#1B4332',
          'primary-light': '#a5d0b9',
          bg: '#fafaf5',
          surface: '#f4f4ef',
          'surface-deep': '#eeeee9',
          accent: '#c1c8c2',
          secondary: '#3b6090',
          'text-main': '#1c1917',
          'text-muted': '#78716c',
        },
      },
      borderRadius: {
        card: '1rem',
      },
      boxShadow: {
        'wayfarer-soft': '0 8px 24px rgba(0, 0, 0, 0.05)',
        'wayfarer-ambient': '0 12px 28px rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
