/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Single deliberate accent (blue) used consistently across UI + charts.
        primary: {
          50: '#eaf2fc',
          100: '#cde2fb',
          200: '#9ec5f4',
          300: '#6da7ec',
          400: '#3987e5',
          500: '#2a78d6',
          600: '#256abf',
          700: '#1c5cab',
          800: '#184f95',
          900: '#104281',
        },
        // Neutral gray scale for text / surfaces / borders.
        neutral: {
          50: '#fafafa',
          100: '#f4f4f3',
          200: '#e6e5e2',
          300: '#d4d3cf',
          400: '#a8a7a1',
          500: '#7c7b75',
          600: '#5c5b56',
          700: '#44433f',
          800: '#2c2b28',
          900: '#1a1a19',
        },
        // Semantic status colors, used sparingly (pass/fail, violations, warnings).
        success: {
          50: '#e9f8e9',
          100: '#d1f0d1',
          500: '#0ca30c',
          600: '#0a8a0a',
          700: '#087608',
          800: '#065906',
        },
        danger: {
          50: '#fbeaea',
          100: '#f6d0d0',
          500: '#d03b3b',
          600: '#b93030',
          700: '#9c2828',
          800: '#7a1f1f',
        },
        warning: {
          50: '#fff6e6',
          100: '#ffe8b8',
          500: '#fab219',
          600: '#e09e0b',
          700: '#b98305',
          800: '#8f6604',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(26,26,25,0.06), 0 1px 3px 0 rgba(26,26,25,0.08)',
      },
    },
  },
  plugins: [],
};
