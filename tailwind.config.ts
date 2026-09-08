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

        /*
         * The rebrand, mapped onto the names already in the code.
         *
         * Every screen names a role rather than a hex: `violet` is the primary
         * action, `coral` is a heading, `paper` is the page. Repointing those
         * names moves the whole app at once and keeps the roles intact, which
         * a find-and-replace to `hot` and `bg` would not: it would touch four
         * hundred class names and get some of them wrong.
         *
         * The new names are here too, for anything written from now on.
         */

        /*
         * One pink, everywhere, and the two rules that make it work.
         *
         * #FF2D8A is 3.5:1 against white. That is fine behind large text and
         * fine as a fill; it is not enough for white text on a button, and it
         * is not enough for a 13px link. A second, deeper pink solved that and
         * cost the brand its single accent, which is a bad trade.
         *
         * So the pink stays exactly one value and the two failing uses move
         * instead. A filled button carries ink rather than white, at 5.1:1,
         * which is also the bolder look. And a small text link takes `link`
         * below, which is the palette's own third accent rather than another
         * pink.
         */
        violet: "#FF2D8A",
        // Hover only, on a fill that carries ink.
        "violet-deep": "#E31E77",
        "violet-tint": "rgba(255,45,138,0.08)",
        // --a3. Movement and secondary data, and the small interactive text
        // that pink cannot carry. 7.2:1 on white.
        link: "#2A43D9",
        hot: { DEFAULT: "#FF2D8A", deep: "#E31E77" },

        // Headings, which the palette allows in the primary at display sizes
        // and 800 weight. The app's h1s are 28px and up.
        coral: "#FF2D8A",
        // 3.5:1 on white is fine for a 32px heading and not for an 11px label.
        // Lightened for the one eyebrow that sits on the dark hero block.
        "coral-light": "#FF7AB4",
        "coral-tint": "rgba(255,45,138,0.08)",

        // --a3. Movement and secondary data. Explicitly not buttons.
        inkblue: "#2A43D9",

        // --a2. Completion only, and never carrying text: a dot, a stroke, or
        // a fill behind dark ink.
        lime: "#C7F53C",

        // Text and structure.
        ink: "#1A1626",
        slate: "#4A4360",
        "text-muted": "#6A6280",
        body: "#4A4360",
        muted: "#6A6280",

        /*
         * Surface.
         *
         * Two weights, not one. The spec gives a single --hair at 12%, which
         * is right for something that has to read as an edge: a field, a
         * ghost button, the rule under a nav. Used as the divider between
         * rows of a list it is far too strong, because there are twenty of
         * them stacked and the eye adds them up. The old #E8EAEF was about 8%
         * and nobody ever noticed it, which is the job.
         *
         * `line` is the quiet one and is what the 186 existing borders use.
         * `hair` is the spec's value, for anything that has to be seen.
         */
        line: "rgba(26,22,38,0.08)",
        hair: "rgba(26,22,38,0.12)",
        paper: "#F2F0F7",
        bg: "#F2F0F7",
        surface: "#FFFFFF",
        "surface-sunk": "#F2F0F7",

        /*
         * Completion.
         *
         * Lime is the signal and it never carries a word: 1.5:1 on white,
         * which is invisible as text and perfectly legible as a fill behind
         * ink or as a dot on a line. So `success` is the dark green that the
         * words are set in, and the limes are what sits behind them.
         */
        success: "#3F6212",
        "success-tint": "rgba(199,245,60,0.35)",
        mint: "#F1FBD9",
        "mint-solid": "#C7F53C",

        // State. The spec's #D92D20 is 4.28:1 on the new page ground, just
        // under AA, and overdue text is the last thing to make hard to read.
        overdue: "#C4302E",
        "overdue-tint": "rgba(196,48,46,0.08)",
        amber: "#B54708",
        "amber-tint": "rgba(181,71,8,0.08)",
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
        display: ["var(--font-display)", "ui-sans-serif", "sans-serif"],
        body: ["var(--font-body)", "-apple-system", "sans-serif"],
        // Figures, dates and references. Was a licensed face with no file
        // behind it, so it never rendered as anything but the fallback.
        label: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "10px",
        md: "16px",
        lg: "22px",
        card: "22px",
      },
      boxShadow: {
        card: "0 12px 34px rgba(26,22,38,.07)",
        float: "0 18px 44px rgba(26,22,38,.10)",
        panel: "0 12px 34px rgba(26,22,38,.07)",
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
        spring: "cubic-bezier(.2,1.6,.4,1)",
        draw: "cubic-bezier(.3,1.15,.35,1)",
        move: "cubic-bezier(.6,0,.3,1)",
        quick: "cubic-bezier(.4,0,.2,1)",
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
