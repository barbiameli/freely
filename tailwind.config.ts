import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        coral: "#F45B69",
        violet: "#6320EE",
        "violet-tint": "rgba(99,32,238,0.07)",
        ink: "#343434",
        slate: "#565656",
        line: "#E8EAEF",
        paper: "#F8F9FA",
        mint: "#F1F7EE",
        "mint-solid": "#E1F9EB",
        success: "#065F46",
        "text-muted": "#8A8990",
        "coral-tint": "rgba(244,91,105,0.08)",
        overdue: "#C4302E",
        "overdue-tint": "rgba(196,48,46,0.08)",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "-apple-system", "sans-serif"],
        label: ["var(--font-label)", "cursive"],
      },
      borderRadius: {
        card: "16px",
      },
      boxShadow: {
        panel: "0px 20px 40px 0px rgba(0,0,0,0.05)",
      },
    },
  },
  plugins: [],
};
export default config;
