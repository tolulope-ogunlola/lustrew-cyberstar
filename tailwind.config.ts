import type { Config } from "tailwindcss";

// Colors are driven by CSS variables (defined in globals.css for :root=light and .dark=dark) so
// the whole app themes without per-component changes. The rgb(var(--x) / <alpha-value>) form keeps
// Tailwind opacity utilities (e.g. bg-ink-900/60) working.
const v = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: v("--ink-950"),
          900: v("--ink-900"),
          800: v("--ink-800"),
          700: v("--ink-700"),
          600: v("--ink-600"),
        },
        // Merges into Tailwind's slate scale — only the shades the app uses are theme-aware.
        slate: {
          100: v("--slate-100"),
          200: v("--slate-200"),
          300: v("--slate-300"),
          400: v("--slate-400"),
          500: v("--slate-500"),
          600: v("--slate-600"),
        },
        brand: {
          300: v("--brand-300"),
          400: v("--brand-400"),
          500: v("--brand-500"),
          600: v("--brand-600"),
        },
        accent: {
          400: v("--accent-400"),
          500: v("--accent-500"),
        },
        // These specific status-text shades are theme-aware so inline success/error/warn/info text
        // stays legible in light mode (darker) and dark mode (lighter) without per-file edits.
        red: { 400: v("--red-400") },
        emerald: { 300: v("--emerald-300") },
        amber: { 200: v("--amber-200"), 300: v("--amber-300") },
        sky: { 300: v("--sky-300") },
        yellow: { 300: v("--yellow-300") },
      },
    },
  },
  plugins: [],
};

export default config;
