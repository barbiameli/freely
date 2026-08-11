"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Fades and lifts its children in when they scroll into view.
 *
 * On the marketing page, where each section has a picture of part of the app
 * beside it. Motion earns its place here by drawing the eye to the visual as
 * you arrive at the section, rather than presenting four static blocks that get
 * scrolled past.
 *
 * An observer rather than a CSS animation on load: everything below the fold
 * would otherwise finish animating before it was ever looked at, which is the
 * same as no animation but with a jump on arrival.
 *
 * It runs once. Re-animating on the way back up is a fidget, not a flourish.
 *
 * Anyone who has asked their system to reduce motion gets the finished state
 * immediately. That is checked before the observer is set up rather than by
 * disabling the transition, so no timer or class change happens at all.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  /** Milliseconds, for staggering two things in the same section. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver !== "function") {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setShown(true);
          observer.disconnect();
        }
      },
      // A little way in, so it has started before it is fully on screen and
      // does not appear to react to the scroll stopping.
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none ${
        shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      } ${className}`}
      style={shown && delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
