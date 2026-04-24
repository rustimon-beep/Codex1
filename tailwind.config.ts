import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      animation: {
        'orbit-slow': 'orbit-slow 10s linear infinite',
        'orbit-reverse': 'orbit-reverse 14s linear infinite',
        'pulse-soft': 'pulse-soft 2.8s ease-in-out infinite',
      },
      keyframes: {
        'orbit-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'orbit-reverse': {
          '0%': { transform: 'rotate(360deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
        'pulse-soft': {
          '0%, 100%': {
            opacity: '0.55',
            transform: 'scale(1)',
          },
          '50%': {
            opacity: '0.95',
            transform: 'scale(1.04)',
          },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};

export default config;
