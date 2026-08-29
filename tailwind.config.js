/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}","./components/**/*.{js,ts,jsx,tsx,mdx}","./lib/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0a0a0a",
        panel: "#141414",
        line: "#252525",
        muted: "#9a9a9a",
        accent: "#ff7a00",
        "accent-2": "#ffb600"
      },
      fontFamily: { mono: ["ui-monospace","SFMono-Regular","Menlo","monospace"], sans: ["Inter","system-ui","sans-serif"] }
    }
  },
  plugins: []
};
