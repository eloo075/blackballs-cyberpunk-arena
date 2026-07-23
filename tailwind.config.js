/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'cp-bg': '#050714',
        'cp-bg-2': '#0a0e24',
        'cp-panel': '#0e1430',
        'cp-cyan': '#00f0ff',
        'cp-magenta': '#ff003c',
        'cp-purple': '#9d00ff',
        'cp-yellow': '#fcee0a',
        'cp-green': '#00ff9c',
        'cp-orange': '#ff6b00',
      },
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
