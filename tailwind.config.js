/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"Fraunces"', 'Georgia', 'serif'],
      },
      colors: {
        ink: '#1a1f1c',
        paper: '#f6f4ef',
        accent: '#0f766e',
        accentDark: '#0d5c56',
        panel: '#eceae3',
      },
    },
  },
  plugins: [],
};
