/**
 * Freely, as a face.
 *
 * The guide needed somebody to be talking. A dark card with two lines of text
 * in it reads as a system message, and a system message is something you close
 * without reading. A face makes the same two lines read as advice, which is
 * what they are.
 *
 * Built from the brand rather than invented next to it: the coral of the
 * wordmark, the violet of every action, and the flourish under the logo
 * becoming a smile. Drawn as SVG so it stays sharp and costs nothing to ship.
 *
 * It blinks. Not for charm: a shape that moves occasionally is a shape the eye
 * returns to, and the whole problem with the old card was that people scrolled
 * past it.
 */
export function FreelyFace({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="20" cy="20" r="20" fill="#F45B69" />
      {/* A lighter cap, so the head has a light source and reads as round. */}
      <path d="M0 20a20 20 0 0 1 40 0Z" fill="#FFFFFF" opacity="0.12" />

      <g className="guide-face-eyes">
        <circle cx="14" cy="18" r="2.6" fill="#FFFFFF" />
        <circle cx="26" cy="18" r="2.6" fill="#FFFFFF" />
      </g>

      {/* The flourish from the wordmark, turned up at the end. */}
      <path
        d="M12.5 26.5c2.6 3.2 12.4 3.2 15 0"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
