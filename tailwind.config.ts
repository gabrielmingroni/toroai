import type { Config } from "tailwindcss";

/**
 * CAD chrome theme — matches toroai-demo-v8-cad.html exactly.
 * Charcoal UI, light canvas, warm Revit-style orange for selection / active state.
 * This is intentionally NOT a typical SaaS palette.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Chrome (dark UI surfaces)
        "chrome-darkest": "#14161a",
        "chrome-dark": "#1f2126",
        chrome: "#2a2d33",
        "chrome-light": "#34373d",
        "chrome-lighter": "#3f434b",
        divider: "#14161a",

        // Text on chrome
        text: "#e8ecef",
        text2: "#d8dce0",
        text3: "#8a8e95",
        text4: "#5a5e66",

        // Accent (Revit selection orange)
        accent: "#f6a623",
        "accent-strong": "#ff8c00",
        "accent-soft": "rgba(246, 166, 35, 0.18)",

        // Status semantics (subdued, not vibrant)
        pass: "#3fae5d",
        warn: "#c9931f",
        fail: "#c44a4a",
        info: "#4a90d6",

        // Canvas (drawing surface — light)
        "canvas-bg": "#f4f4f4",
        "canvas-grid": "#dcdcd8",
        "canvas-line": "#3a3a3a",
        "canvas-text": "#2a2a2a",
        "canvas-text2": "#666666",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        body: ["12px", { lineHeight: "1.5" }],
      },
    },
  },
  plugins: [],
};

export default config;
