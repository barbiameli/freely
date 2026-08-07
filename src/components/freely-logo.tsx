/** Freely's own wordmark — the italic "Freely" text plus the small coral
 * flourish line that sits under/beside it (from the Figma brand file). One
 * shared component so every place the wordmark appears (sidebar, auth
 * pages, marketing site) stays in sync. */

const SIZES = {
  sm: { text: "text-[22px]", flourishWidth: 34, flourishOffset: { top: -2, left: 44 } },
  md: { text: "text-3xl", flourishWidth: 44, flourishOffset: { top: -2, left: 58 } },
  lg: { text: "text-[40px]", flourishWidth: 56, flourishOffset: { top: -2, left: 74 } },
} as const;

export function FreelyLogo({ size = "md" }: { size?: keyof typeof SIZES }) {
  const s = SIZES[size];
  return (
    <span className="relative inline-flex items-center">
      <span className={`font-display italic ${s.text} text-coral`}>Freely</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/flourish.svg"
        alt=""
        aria-hidden="true"
        className="absolute pointer-events-none"
        style={{ width: s.flourishWidth, top: s.flourishOffset.top, left: s.flourishOffset.left }}
      />
    </span>
  );
}
