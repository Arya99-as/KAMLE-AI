import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#2563EB",
          dark: "#1E40AF",
          light: "#EFF6FF",
          50: "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          400: "#60A5FA",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
          800: "#1E40AF",
          900: "#1E3A8A",
        },
        ink: "#0F172A",
        muted: "#64748B",
        line: "#E2E8F0",
        canvas: "#F8FAFC",
        success: { DEFAULT: "#16A34A", light: "#F0FDF4" },
        danger: { DEFAULT: "#DC2626", light: "#FEF2F2" },
        warning: { DEFAULT: "#EA580C", light: "#FFF7ED" },
        ai: { DEFAULT: "#7C3AED", light: "#F5F3FF" },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      borderRadius: {
        card: "16px",
      },
      boxShadow: {
        card: "0 1px 2px rgb(15 23 42 / 0.05), 0 4px 16px rgb(15 23 42 / 0.06)",
        lift: "0 2px 4px rgb(15 23 42 / 0.06), 0 12px 28px rgb(15 23 42 / 0.12)",
        ai: "0 0 0 3px rgb(124 58 237 / 0.18)",
      },
    },
  },
  plugins: [],
} satisfies Config;