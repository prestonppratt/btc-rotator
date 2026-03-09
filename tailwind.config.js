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
        'apple-green': '#34C759',
        'apple-red': '#FF3B30',
        'primary': '#0A84FF', // Apple system blue
        'primary-dark': '#0066CC',
        'panel-bg': '#1C1C1E', // Apple dark mode card bg
      },
      boxShadow: {
        'premium': '0 4px 24px -1px rgba(0, 0, 0, 0.5), 0 2px 8px -1px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [],
}

