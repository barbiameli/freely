/**
 * What sits behind everything.
 *
 * The app was paper-coloured with white cards on it, which is legible and
 * completely flat: six cards down a page read as one sheet with lines drawn on
 * it, and nothing on screen had any sense of being nearer or further away.
 *
 * Two very large, very soft washes of the brand's own colours, and a faint
 * grain over the top. Both are far behind the content and neither has an edge,
 * so nothing here competes with a figure or a heading: the page reads the same
 * and stops looking like a spreadsheet.
 *
 * Fixed rather than scrolling, so it behaves like a room the content moves
 * through rather than a picture stuck to the back of it. Pointer-events none,
 * because a decoration that eats a click is a bug.
 */
export function Backdrop() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden>
      {/* Coral, top left, drifting slowly. Sized in viewport units so it stays
          a wash on a laptop and does not become a blob on a phone. */}
      <div
        className="absolute -top-[18vh] -left-[12vw] w-[62vw] h-[62vw] rounded-full opacity-[0.14] blur-[120px] animate-drift-a motion-reduce:animate-none"
        style={{ background: "radial-gradient(circle, #F45B69 0%, transparent 70%)" }}
      />
      {/* Violet, bottom right, on a different rhythm so the two never line up
          and start reading as one moving object. */}
      <div
        className="absolute -bottom-[22vh] -right-[10vw] w-[58vw] h-[58vw] rounded-full opacity-[0.13] blur-[120px] animate-drift-b motion-reduce:animate-none"
        style={{ background: "radial-gradient(circle, #6320EE 0%, transparent 70%)" }}
      />
      {/* Grain. Two per cent, which is under the threshold of noticing and
          over the threshold of the page feeling like a surface. An inline SVG
          rather than an image, so it costs no request. */}
      <div
        className="absolute inset-0 opacity-[0.022] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
