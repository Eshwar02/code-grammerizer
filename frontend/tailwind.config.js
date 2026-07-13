/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    borderRadius: { none: '0', DEFAULT: '0', sm: '0', md: '0', lg: '0', xl: '0', '2xl': '0', full: '9999px' },
    extend: {
      colors: {
        blue: {
          50:  '#eef0fd',
          100: '#d6dcfb',
          200: '#adb8f8',
          400: '#4361EE',
          500: '#3451D1',
          600: '#2a3ea0',
          700: '#1e2d75',
        },
        lime: {
          400: '#22C55E',
          500: '#16A34A',
          600: '#15803D',
        },
        ink: {
          50:  '#f7f7f8',
          100: '#ebebed',
          200: '#d4d4d8',
          400: '#9898a3',
          600: '#52525e',
          800: '#1e1e28',
          900: '#111118',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
