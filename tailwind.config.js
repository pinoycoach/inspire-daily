/** @type {import('tailwindcss').Config} */
// Same Tailwind (v3) the page used from the CDN, now built into the app for production.
export default {
  content: ['./index.html', './*.tsx', './components/**/*.tsx', './services/**/*.ts', './data/**/*.ts', './constants.ts'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out both',
        'fade-in-fast': 'fade-in 0.2s ease-out both',
        fade: 'fade-in 0.4s ease-out both',
      },
    },
  },
  plugins: [],
};
