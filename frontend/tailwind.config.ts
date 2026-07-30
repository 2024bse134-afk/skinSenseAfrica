import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,js,jsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: '#163330',
        forest: '#0E3B36',
        mist: '#F3F6F1',
        cream: '#F8F6EF',
        sand: '#E9E4D8',
        moss: '#187765',
        sage: '#DDEBE3',
        coral: '#DF6A4A',
        sun: '#F2C75C',
      },
      boxShadow: {
        soft: '0 18px 55px rgba(14, 59, 54, 0.09)',
        lift: '0 24px 80px rgba(14, 59, 54, 0.14)',
        brand: '0 8px 20px rgba(14, 59, 54, 0.22)',
      },
      fontFamily: {
        display: ['Georgia', 'Cambria', '"Times New Roman"', 'serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
