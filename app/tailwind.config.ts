import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.ts"],
  theme: {
    extend: {
      colors: {
        ink: "var(--fg)",
        muted: "var(--muted)",
        line: "var(--line)",
        accent: "var(--accent)",
        good: "var(--good)",
        warn: "var(--warn)",
        bad: "var(--bad)",
      },
      fontFamily: {
        display: ["var(--font-body)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
