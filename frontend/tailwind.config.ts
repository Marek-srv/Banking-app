import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bank: {
          navy: "#0B1F3A",
          dark: "#061A33",
          blue: "#0B63E5",
          light: "#EAF2FB",
          page: "#F6F8FB",
          text: "#172033",
          muted: "#667085",
          border: "#E4E7EC",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 18px 55px rgba(11, 31, 58, 0.10)",
      },
    },
  },
  plugins: [],
} satisfies Config;
