"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The marketing page's motion, in one file.
 *
 * Three rules it follows throughout.
 *
 * Motion is triggered by arriving somewhere, not by the page loading. Anything
 * below the fold that animates on load has finished before it is looked at,
 * which is the same as no animation plus a jump when you get there. So an
 * IntersectionObserver, and only the hero animates on mount, because the hero is
 * the only thing already on screen.
 *
 * Every animation runs once. Re-animating on the way back up is a fidget.
 *
 * Anyone who has asked their system for less motion gets the finished state
 * immediately: not a shortened animation, none at all. That is checked before
 * any observer or timer is created, so nothing is scheduled to be skipped.
 *
 * Built on CSS transitions rather than an animation library. Everything here is
 * an opacity, a transform or a width, which the compositor handles on its own,
 * and a 40kB dependency to move four sections is not a trade worth making.
 */

/** Whether this visitor has asked for less movement. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Tells you when a node has been scrolled to, once.
 *
 * Returns true straight away for reduced motion or a browser without the
 * observer, so a caller can always treat true as "show the finished state" and
 * never needs to handle the absence of animation itself.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(threshold = 0.15) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (prefersReducedMotion() || typeof IntersectionObserver !== "function") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setInView(true);
          observer.disconnect();
        }
      },
      // Starts a little before it is fully on screen, so it does not appear to
      // be reacting to the scroll stopping.
      { threshold, rootMargin: "0px 0px -8% 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}

/** Which direction the thing comes from. */
export type RevealFrom = "up" | "left" | "right" | "scale";

const HIDDEN: Record<RevealFrom, string> = {
  up: "opacity-0 translate-y-6",
  left: "opacity-0 -translate-x-6",
  right: "opacity-0 translate-x-6",
  // Slightly under size and slightly low: a picture that grows into place reads
  // as coming forward rather than sliding past.
  scale: "opacity-0 translate-y-4 scale-[0.97]",
};

/** Fades its children in when they are scrolled to. */
export function Reveal({
  children,
  delay = 0,
  from = "up",
  className = "",
}: {
  children: ReactNode;
  /** Milliseconds, for staggering two things in the same section. */
  delay?: number;
  from?: RevealFrom;
  className?: string;
}) {
  const { ref, inView } = useInView();

  return (
    <div
      ref={ref}
      className={`transition-[opacity,transform] duration-[850ms] ease-marketing motion-reduce:transition-none ${
        inView ? "opacity-100 translate-x-0 translate-y-0 scale-100" : HIDDEN[from]
      } ${className}`}
      style={inView && delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/**
 * The same thing on mount, for the hero.
 *
 * The hero is on screen before anything is scrolled, so waiting for an observer
 * would mean it animates only if you scroll away and back. Given delays in
 * sequence it becomes a single entrance: headline, then the line under it, then
 * the picture, then the buttons.
 *
 * The first frame has to paint in the hidden state or there is nothing to
 * animate from, hence the mounted flag rather than an initial value of true.
 */
export function Rise({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(true);
      return;
    }
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className={`transition-[opacity,transform] duration-[850ms] ease-marketing motion-reduce:transition-none ${
        shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
      } ${className}`}
      style={shown && delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/**
 * A number that counts up to its value.
 *
 * Only worth doing where the number is the point: a quote total, a percentage
 * complete. Written against a timestamp rather than a fixed step, so it takes
 * the same time on a slow device as a fast one instead of running long.
 *
 * Eased out, because a count that decelerates lands on its final value, and one
 * at a constant speed just stops.
 */
export function Tally({
  value,
  prefix = "",
  suffix = "",
  duration = 1100,
  start,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  /** Pass the section's inView, so it counts when it is looked at. */
  start: boolean;
}) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!start) return;
    if (prefersReducedMotion()) {
      setShown(value);
      return;
    }

    let frame = 0;
    const begun = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - begun) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [start, value, duration]);

  return (
    <>
      {prefix}
      {shown.toLocaleString("en-GB")}
      {suffix}
    </>
  );
}

/**
 * A progress bar that fills to its width.
 *
 * The bars in the previews are the one part of those pictures that is genuinely
 * about change over time, so they are the part worth animating. Filling from
 * zero also makes the difference between three projects readable: they arrive at
 * different lengths at different moments rather than being three static lines to
 * compare.
 */
export function GrowBar({
  fraction,
  color,
  start,
  delay = 0,
}: {
  /** 0 to 1. */
  fraction: number;
  /** A Tailwind background class. */
  color: string;
  start: boolean;
  delay?: number;
}) {
  return (
    <span
      className={`block h-full rounded-full transition-[width] duration-[1100ms] ease-marketing motion-reduce:transition-none ${color}`}
      style={{
        width: start ? `${fraction * 100}%` : "0%",
        transitionDelay: start ? `${delay}ms` : undefined,
      }}
    />
  );
}

/**
 * Reveals a list one item after another.
 *
 * A wrapper per row rather than a CSS animation on the parent, because the rows
 * need their own delays and the parent is a grid whose children cannot be
 * offset without breaking the layout.
 */
export function StaggerItem({
  children,
  index,
  start,
  step = 90,
  className = "",
}: {
  children: ReactNode;
  index: number;
  start: boolean;
  /** Milliseconds between one row and the next. */
  step?: number;
  className?: string;
}) {
  return (
    <div
      className={`transition-[opacity,transform] duration-500 ease-marketing motion-reduce:transition-none ${
        start ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      } ${className}`}
      style={start ? { transitionDelay: `${index * step}ms` } : undefined}
    >
      {children}
    </div>
  );
}
