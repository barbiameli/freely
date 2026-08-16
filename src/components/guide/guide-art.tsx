import type { GuideStep } from "@/lib/guide";

/**
 * A small drawing of the thing the hint is about.
 *
 * One per step, and each one draws the action rather than labelling it: a plane
 * for sending, a browser for the client's page, a receipt for the invoice.
 * Somebody who reads nothing else should still know roughly what this card is
 * about from the picture.
 *
 * Line work only, at a single weight, on no background. A filled illustration
 * at this size turns into a blob, and a stroke at a consistent weight sits next
 * to the interface instead of competing with it.
 *
 * Two colours: violet for the object, coral for the one part that moves or
 * matters. The second colour is what stops these reading as icons. It is always
 * the smaller mark, so the drawing still reads as one thing.
 */

const VIOLET = "#6320EE";
const CORAL = "#F45B69";

export function GuideArt({ step, size = 46 }: { step: GuideStep; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 46 46"
      fill="none"
      stroke={VIOLET}
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 guide-art"
    >
      {art(step)}
    </svg>
  );
}

function art(step: GuideStep) {
  switch (step) {
    // A document with writing on it, and a spark: the brief becoming a quote.
    case "quote":
      return (
        <>
          <path d="M12 7h13l9 9v23a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" />
          <path d="M25 7v9h9" />
          <path d="M15 24h11M15 30h14M15 36h8" />
          <path d="M37 31.5v5M34.5 34h5" stroke={CORAL} />
        </>
      );

    // A paper plane, mid flight, with its trail.
    case "publish":
      return (
        <>
          <path d="M39 8 7 21l13 5 4 12z" />
          <path d="M39 8 20 26" />
          <path d="M5 28h7M9 34h5" stroke={CORAL} />
        </>
      );

    // A clipboard: the agreed work, now a list to work through.
    case "track":
      return (
        <>
          <path d="M14 10h-2a2 2 0 0 0-2 2v25a2 2 0 0 0 2 2h22a2 2 0 0 0 2-2V12a2 2 0 0 0-2-2h-2" />
          <rect x="17" y="6" width="12" height="7" rx="2" />
          <path d="M16 22h14M16 29h10" />
          <path d="m30 27 3 3 5-6" stroke={CORAL} />
        </>
      );

    // One line branching into three: a deliverable becoming steps.
    case "breakdown":
      return (
        <>
          <rect x="5" y="7" width="16" height="9" rx="2.5" />
          <path d="M13 16v18.5M13 22.5h10M13 34.5h10" />
          <rect x="23" y="18" width="17" height="9" rx="2.5" stroke={CORAL} />
          <rect x="23" y="30" width="17" height="9" rx="2.5" stroke={CORAL} />
        </>
      );

    // A browser window, with the page inside it.
    case "client":
      return (
        <>
          <rect x="5" y="9" width="36" height="28" rx="3" />
          <path d="M5 17h36" />
          <circle cx="10" cy="13" r="1.1" fill={VIOLET} stroke="none" />
          <circle cx="14" cy="13" r="1.1" fill={VIOLET} stroke="none" />
          <path d="M12 23h10M12 29h16" stroke={CORAL} />
        </>
      );

    // A receipt, with the amount marked.
    case "invoice":
      return (
        <>
          <path d="M11 7h24v32l-4-3-4 3-4-3-4 3-4-3-4 3z" />
          <path d="M17 17h12M17 24h12" />
          <path d="M17 31h8" stroke={CORAL} />
        </>
      );
  }
}
