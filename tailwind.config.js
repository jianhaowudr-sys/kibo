/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        kibo: {
          bg: 'rgb(var(--kibo-bg) / <alpha-value>)',
          surface: 'rgb(var(--kibo-surface) / <alpha-value>)',
          card: 'rgb(var(--kibo-card) / <alpha-value>)',
          primary: 'rgb(var(--kibo-primary) / <alpha-value>)',
          accent: 'rgb(var(--kibo-accent) / <alpha-value>)',
          success: 'rgb(var(--kibo-success) / <alpha-value>)',
          danger: 'rgb(var(--kibo-danger) / <alpha-value>)',
          strength: 'rgb(var(--kibo-strength) / <alpha-value>)',
          cardio: 'rgb(var(--kibo-cardio) / <alpha-value>)',
          flex: 'rgb(var(--kibo-flex) / <alpha-value>)',
          text: 'rgb(var(--kibo-text) / <alpha-value>)',
          mute: 'rgb(var(--kibo-mute) / <alpha-value>)',
        },
      },
      fontFamily: {
        display: ['System'],
      },
    },
  },
  plugins: [],
};
