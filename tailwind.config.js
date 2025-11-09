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
      },
    },
  },
  plugins: [],
}

