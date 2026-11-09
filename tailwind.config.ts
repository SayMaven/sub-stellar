import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        gatefold: {
          bg: "var(--bg)",
          surface: "var(--surface)",
          "surface-2": "var(--surface-2)",
          text: "var(--text)",
          "text-2": "var(--text-2)",
          "text-3": "var(--text-3)",
          accent: "var(--accent)",
          glow: "var(--glow)",
          "blob-1": "var(--blob-1)",
          "blob-2": "var(--blob-2)",
          "blob-3": "var(--blob-3)",
          line: "var(--line)",
          "line-2": "var(--line-2)",
          hover: "var(--hover)",
          panel: "var(--panel)",
          "panel-strong": "var(--panel-strong)",
        },
      },
      borderRadius: {
        sm: "var(--r-sm)",
        DEFAULT: "var(--r)",
        lg: "var(--r-lg)",
      },
      boxShadow: {
        pop: "var(--shadow-pop)",
      },
      transitionTimingFunction: {
        gatefold: "var(--ease)",
      },
      transitionDuration: {
        gatefold: "var(--tx)",
      },
    },
  },
  plugins: [],
} satisfies Config;

