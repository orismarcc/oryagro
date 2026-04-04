/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        verde: {
          900: '#163820',
          800: '#1e4d2b',
          700: '#2d6a4f',
          500: '#40916c',
          400: '#52b788',
          100: '#d8f3dc',
          50:  '#f0faf3',
        },
        ambar: {
          800: '#8a3414',
          600: '#b5451b',
          400: '#e07b56',
          100: '#fde8e0',
          50:  '#fff5f2',
        },
        terra: {
          800: '#4a2f0a',
          600: '#7b4f12',
          400: '#b5832a',
          100: '#f5e6d3',
          50:  '#fdf8f2',
        },
        dourado: {
          600: '#a07810',
          400: '#d4a017',
          100: '#fff8e1',
        },
        papel: {
          DEFAULT: '#f7f5f0',
          dark: '#eeeae3',
        },
        borda: '#e8e4de',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['DM Sans', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '6px',
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '10px',
      },
    },
  },
  plugins: [],
};
