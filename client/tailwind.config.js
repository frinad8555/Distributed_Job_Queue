
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dashboard: {
          bg: "#0B1020",
          panel: "#111827",
          border: "#263044",
          muted: "#94A3B8",
          purple: "#8B7CFF",
        },
      },
    },
  },
  plugins: [],
};
