import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,js,jsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: '#132238',
        mist: '#f4efe8',
        sand: '#eadfce',
        moss: '#3a5a40',
        coral: '#c65b4f',
        sun: '#e7b84b',
      },
      boxShadow: {
        soft: '0 24px 80px rgba(19, 34, 56, 0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
