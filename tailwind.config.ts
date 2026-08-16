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
      // A named scale, so a new component picks a role rather than inventing
      // another pixel value. The app had twenty distinct sizes including
      // 11/11.5, 12/12.5, 13/13.5 and 14/14.5 pairs, which nobody can tell
      // apart but which made every screen slightly inconsistent.
      fontSize: {
        // Uppercase labels and eyebrows.
        caption: ["11px", { lineHeight: "1.4" }],
        // Timestamps, counts, hints under a field.
        meta: ["12px", { lineHeight: "1.5" }],
        // Secondary copy and dense lists.
        small: ["13px", { lineHeight: "1.55" }],
        // Default interface text.
        body: ["14px", { lineHeight: "1.6" }],
        // Text meant to be read rather than scanned, in a quote or a page
        // intro.
        lead: ["15px", { lineHeight: "1.7" }],
        // Section headings inside a page.
        title: ["18px", { lineHeight: "1.35" }],
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "-apple-system", "sans-serif"],
        label: ["var(--font-label)", "ui-sans-serif", "sans-serif"],
      },
      borderRadius: {
        card: "16px",
      },
      boxShadow: {
        panel: "0px 20px 40px 0px rgba(0,0,0,0.05)",
        // For a preview lifting under the cursor on the marketing page. Deeper
        // and slightly warmer than the resting shadow, which is what makes it
        // read as rising rather than as growing a bigger shadow.
        lift: "0px 28px 60px -12px rgba(52,52,52,0.16)",
        // A dialog sitting over a dimmed page. Much heavier than `panel`,
        // which at 5% is invisible against a backdrop and left every overlay
        // reading as a white rectangle pasted onto the screen rather than as
        // something floating above it.
        dialog: "0px 24px 64px -12px rgba(20,20,20,0.35)",
      },
      transitionTimingFunction: {
        // One easing across the whole marketing page. Decelerating hard at the
        // end is what separates something arriving from something sliding: a
        // linear or symmetric ease reads as mechanical at these durations.
        marketing: "cubic-bezier(0.16, 0.84, 0.28, 1)",
      },
    },
  },
  plugins: [],
};
export default config;
