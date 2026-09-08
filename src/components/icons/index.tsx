/**
 * The six icons that carry the product.
 *
 * Duotone: an ink structure at 2.4px with exactly one element in the accent,
 * and the accent is always the part that means something. The rising line in
 * Quote, the live bar in Track, the arrowhead in Send. Strip the colour and a
 * working monoline set is left behind, which is the test for whether the
 * colour was decorative.
 *
 * The structure uses currentColor, so an icon takes the colour of the text
 * around it and the accent stays put. An SVG stroke has no size threshold to
 * clear, which is why the accent here is the full brand pink while a 13px
 * label beside it cannot be.
 *
 * The motion lives in globals.css against `.ico-trigger`: put that class on
 * whatever the person is actually hovering, usually the card or the nav item,
 * so one hover drives the whole thing rather than only the 20px glyph.
 */

type IconProps = { size?: number; className?: string; accent?: string };

const base = (size = 24) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  "aria-hidden": true as const,
  focusable: "false" as const,
});

export function IconQuote({ size, className, accent = "var(--a1)" }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="4" y="3" width="16" height="18" rx="2.6" stroke="currentColor" strokeWidth="2.4" />
      <path
        className="ico-dash"
        pathLength={1}
        d="M7.5,16.2 L11,12.6 L14,14.1 L16.8,8.6"
        stroke={accent}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconTrack({ size, className, accent = "var(--a1)" }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect
        x="3.4"
        y="4.6"
        width="11"
        height="4.6"
        rx="2.3"
        stroke="currentColor"
        strokeWidth="2.4"
      />
      <rect
        className="ico-bar"
        x="7.6"
        y="9.7"
        width="13"
        height="4.6"
        rx="2.3"
        stroke={accent}
        strokeWidth="2.4"
      />
      <rect
        x="3.4"
        y="14.8"
        width="8.6"
        height="4.6"
        rx="2.3"
        stroke="currentColor"
        strokeWidth="2.4"
      />
    </svg>
  );
}

export function IconDiary({ size, className, accent = "var(--a1)" }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path
        d="M6,4 H18 a3,3 0 0 1 3,3 v6 a3,3 0 0 1 -3,3 H12 L7.5,20.5 V16 H6 a3,3 0 0 1 -3,-3 V7 a3,3 0 0 1 3,-3 z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        className="ico-dash"
        pathLength={1}
        d="M7.5,10 H16.5"
        stroke={accent}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle className="ico-dot d1" cx="7.5" cy="10" r="1.5" fill={accent} />
      <circle className="ico-dot d2" cx="16.5" cy="10" r="1.5" fill={accent} />
    </svg>
  );
}

export function IconMemory({ size, className, accent = "var(--a1)" }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path
        className="ico-lift"
        d="M12,3 L20.5,7.2 L12,11.4 L3.5,7.2 Z"
        stroke={accent}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M3.5,12 L12,16.2 L20.5,12"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.5,16.6 L12,20.8 L20.5,16.6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconSend({ size, className, accent = "var(--a1)" }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path
        d="M3,18.5 C9.5,18.5 15.5,13.5 20.2,4.6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/*
        The chevron is mirrored about the curve's own tangent at its end point,
        with the tip exactly on 20.2,4.6. An axis-aligned bracket looked bolted
        on. If the curve is ever changed this has to be recomputed against the
        new tangent rather than nudged by eye.
      */}
      <path
        className="ico-nudge"
        d="M15.8,7.37 L20.2,4.6 L20.4,9.79"
        stroke={accent}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconClient({ size, className, accent = "var(--a1)" }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle
        className="ico-dash"
        pathLength={1}
        cx="12"
        cy="8.2"
        r="3.9"
        stroke={accent}
        strokeWidth="2.4"
      />
      <path
        d="M4.6,20.4 a7.4,7.4 0 0 1 14.8,0"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Completion, so it is the one that is lime rather than pink. */
export function IconCheck({ size, className, accent = "var(--a2)" }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.4" />
      <path
        className="ico-dash"
        pathLength={1}
        d="M7.8,12.3 L10.7,15.2 L16.3,9.2"
        stroke={accent}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
