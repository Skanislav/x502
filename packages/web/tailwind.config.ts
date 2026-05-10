import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surface palette — deep, slightly-blue darks + low-opacity
        // borders to avoid harsh edges. Tuned so accent colour pops without
        // having to dial up saturation.
        ink: {
          DEFAULT: "#06070d",
          900: "#06070d",
          800: "#0a0c14",
          700: "#0f1117",
          600: "#161924",
          500: "#1d2030",
        },
        line: {
          DEFAULT: "rgba(255, 255, 255, 0.06)",
          strong: "rgba(255, 255, 255, 0.10)",
          accent: "rgba(91, 141, 255, 0.32)",
        },
        text: {
          strong: "rgba(255, 255, 255, 0.96)",
          DEFAULT: "rgba(255, 255, 255, 0.78)",
          muted: "rgba(255, 255, 255, 0.55)",
          faint: "rgba(255, 255, 255, 0.32)",
        },
        accent: {
          DEFAULT: "#5b8dff",
          soft: "#80a8ff",
          glow: "rgba(91, 141, 255, 0.18)",
          ring: "rgba(91, 141, 255, 0.45)",
        },
        success: "#34d399",
        warning: "#fbbf24",
        danger: "#f87171",
        // legacy aliases — keep so any unrefactored components still compile
        paper: "#fafafa",
        muted: "rgba(255, 255, 255, 0.55)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.04em" }],
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(91,141,255,0.4), 0 0 32px -8px rgba(91,141,255,0.45)",
        ring: "0 0 0 4px rgba(91,141,255,0.18)",
        card: "inset 0 1px 0 rgba(255,255,255,0.04)",
      },
      backgroundImage: {
        "grid-line": "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px)",
        "grid-fade":
          "radial-gradient(800px 400px at 80% -10%, rgba(91,141,255,0.18), transparent 60%)",
      },
      animation: {
        "pulse-ring": "pulse-ring 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-up": "fade-up 0.45s ease-out both",
        shimmer: "shimmer 2.6s linear infinite",
      },
      keyframes: {
        "pulse-ring": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(91,141,255,0.5)" },
          "50%": { boxShadow: "0 0 0 8px rgba(91,141,255,0)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
