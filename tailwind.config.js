/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#131316',
          900: '#1B1B21',
          800: '#25252D',
          700: '#33333D',
          600: '#4A4A57',
          400: '#83838F',
          200: '#C8C8D1'
        },
        paper: {
          DEFAULT: '#FAF9F6',
          dim: '#F0EEE8'
        },
        signal: {
          DEFAULT: '#5B4CFF',
          dim: '#4A3DE0',
          bright: '#7A6CFF'
        },
        clay: '#FF6A4D',
        moss: '#3FA66B'
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif']
      },
      boxShadow: {
        panel: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.28)'
      },
      borderRadius: {
        xl2: '1.25rem'
      }
    }
  },
  plugins: []
}
