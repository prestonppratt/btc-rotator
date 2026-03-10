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
        'btc-dark': '#0F1214',
        'apple-green': '#34C759',
        'apple-red': '#FF3B30',
        'primary': '#3A86FF',
        'primary-dark': '#2E6FE0',
        'panel-bg': '#161A1D',
      },
      boxShadow: {
        'premium': '0 4px 24px -1px rgba(0, 0, 0, 0.5), 0 2px 8px -1px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [],
}
