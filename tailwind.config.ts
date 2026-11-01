import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.ts"],
  theme: {
    extend: {
      colors: {
        ink: "#12161c",
        paper: "#f4f6f8",
        line: "#d9dee5",
        muted: "#5b6573",
        accent: "#2b59ff",
        good: "#17806d",
        warn: "#c98a00",
        bad: "#d6383f",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
