/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      backdropBlur: {
        xs: '2px',
      },
      backgroundColor: {
        glass: 'rgba(255, 255, 255, 0.1)',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0,0,0,0.1)',
      },
    },
  },
  plugins: [],
};

