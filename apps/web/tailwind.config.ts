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
        display: ['"Space Grotesk"', 'sans-serif'],
      },
      colors: {
        brand: {
          emerald: '#50F58A',
          midnight: '#050914',
        },
      },
    },
  },
  plugins: [],
};

export default config;
