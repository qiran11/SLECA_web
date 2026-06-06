/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17212b',
        panel: '#f8faf9',
        line: '#d9e1df',
        teal: '#0f766e',
        coral: '#d75a4a',
        gold: '#b8860b',
        leaf: '#4d8b57'
      },
      boxShadow: {
        soft: '0 12px 30px rgba(23, 33, 43, 0.08)'
      }
    }
  },
  plugins: []
};
