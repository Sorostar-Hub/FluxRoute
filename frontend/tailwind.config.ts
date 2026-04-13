import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        stellar: {
          blue: '#0E41C9',
          black: '#0D0D0D',
        },
      },
    },
  },
  plugins: [],
};

export default config;
