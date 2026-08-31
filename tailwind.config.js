/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#fdf8ec',
          100: '#f9edc9',
          300: '#eec96a',
          400: '#e5b53d',
          500: '#d69e21',
          600: '#b3801a',
          700: '#8c6215',
        },
        night: {
          900: '#0b0f14',
          800: '#111823',
          700: '#182333',
          600: '#22314a',
        },
      },
      fontFamily: {
        display: ['Georgia', 'ui-serif', 'serif'],
      },
    },
  },
  plugins: [],
};
