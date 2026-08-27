import { HTMLAttributes } from "react";
import clsx from "@/lib/clsx";

/**
 * A section of a page, with a tone that says how much it matters.
 *
 * Every card was white on white with a hairline round it, so a page of six
 * read as one flat surface with lines drawn on it. Nothing was more important
 * than anything else and nothing was subordinate to anything else, which for a
 * page that holds a heading, its controls, and a note about them is three
 * relationships all rendered identically.
 *
 * Three tones, and only three, because a fourth would be a decision to make
 * every time rather than a rule to follow:
 *
 * `plain` is the default and means an ordinary section of the page.
 *
 * `quiet` is a tinted block for something subordinate: a note about the card
 * it sits in, a preview, a summary of what was just chosen. It is the tone
 * that does most of the work, because "this belongs to that" is the
 * relationship a flat page cannot express.
 *
 * `loud` is bordered in violet, for the one thing on a screen that is being
 * asked for. At most one per screen. Two is none.
 */
type Tone = "plain" | "quiet" | "loud";

const toneClasses: Record<Tone, string> = {
  plain: "bg-white border border-line",
  // Keeps its edge, because the canvas is now this same tone: without a border
  // a quiet card would not read as a card at all, it would read as a gap.
  quiet: "bg-paper border border-line",
  loud: "bg-white border-[1.5px] border-violet",
};

export function Card({
  className,
  tone = "plain",
  ...rest
}: HTMLAttributes<HTMLDivElement> & { tone?: Tone }) {
  return (
    <div
      className={clsx(
        // Roomier than it was. The old padding was tight enough that a heading,
        // a hint and a control ran together as one block of text, which is the
        // spacing equivalent of having no hierarchy at all.
        "rounded-card px-6 py-6",
        toneClasses[tone],
        className
      )}
      {...rest}
    />
  );
}
