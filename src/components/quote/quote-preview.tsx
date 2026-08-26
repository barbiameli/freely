"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A full-width page, shrunk to fit a column.
 *
 * The alternative was letting the template reflow into whatever space it has,
 * which reads better and answers the wrong question. A preview exists to show
 * line breaks, column widths and the rhythm of a page, and a responsive
 * rerender changes all three. Shrinking keeps the proportions exactly right and
 * makes the text small, which is the correct trade: this is for checking shape
 * and impression, and the words are already legible in the editor beside it.
 *
 * CSS transform rather than an iframe. An iframe would isolate the styles,
 * which sounds tidier until it needs the app's stylesheet, its fonts and a
 * resize observer of its own, and until a preview that reloads on every save
 * costs a document load rather than a rerender.
 */
const PAGE_WIDTH = 900;

export function QuotePreview({ children }: { children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);

  // Two observers rather than one. The width comes from the column, which
  // changes when the window does; the height comes from the rendered quote,
  // which changes when an edit is saved. Watching only the frame left a long
  // quote clipped, and watching only the page left it stretched after a resize.
  useEffect(() => {
    const frameEl = frame.current;
    const pageEl = page.current;
    if (!frameEl || !pageEl) return;

    const measure = () => {
      const available = frameEl.clientWidth;
      const next = Math.min(1, available / PAGE_WIDTH);
      setScale(next);
      // The wrapper has to reserve the scaled height itself, because a
      // transform does not affect layout: without this the container collapses
      // to nothing and the preview overlaps whatever follows it.
      setHeight(pageEl.scrollHeight * next);
    };

    measure();
    const onFrame = new ResizeObserver(measure);
    const onPage = new ResizeObserver(measure);
    onFrame.observe(frameEl);
    onPage.observe(pageEl);
    return () => {
      onFrame.disconnect();
      onPage.disconnect();
    };
  }, [children]);

  return (
    <div ref={frame} className="w-full overflow-hidden">
      <div style={{ height }}>
        <div
          ref={page}
          style={{
            width: PAGE_WIDTH,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
          // Nothing in here is reachable by keyboard or pointer. It is a
          // picture of a document, and a preview whose buttons can be pressed
          // is a second copy of the page with its own bugs.
          inert
          className="pointer-events-none select-none"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
