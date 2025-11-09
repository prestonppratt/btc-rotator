/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'btc-orange': '#f7931a',
        'btc-dark': '#0a0a0a',
        'neon-green': '#00ff41',
        'neon-orange': '#ff6b35',
        'neon-green-dark': '#00cc33',
      },
      boxShadow: {
        'neon-green': '0 0 10px #00ff41, 0 0 20px #00ff41, 0 0 30px #00ff41',
        'neon-orange': '0 0 10px #f7931a, 0 0 20px #f7931a, 0 0 30px #f7931a',
      },
    },
  },
  plugins: [],
}

