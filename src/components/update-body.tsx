import { updateBlocks } from "@/lib/rich-text";

/**
 * The body of a diary update, with its structure showing.
 *
 * A kick-off update is a plan: "Week 1: Audit and access - you share login
 * access... Week 2-3: Checkout and mobile fixes - redesign the checkout flow..."
 * It was rendered as five paragraphs at one size and one weight, which is a wall
 * of grey a client scrolls past. The labels are already headings in everything
 * but appearance, so they are set as headings: the stage in small caps, the
 * stage's name in bold beside it, the prose underneath.
 *
 * No hooks and no client state, so the diary and the client's page can both use
 * it and neither can drift from the other. They were formatting the same text
 * two different ways before, which is why the client page ran every update
 * together into one block.
 */
export function UpdateBody({
  text,
  /** "small" inside the app, "body" on the client's page, which is read not scanned. */
  size = "small",
}: {
  text: string;
  size?: "small" | "body";
}) {
  const blocks = updateBlocks(text);
  const prose = size === "body" ? "text-body" : "text-small";

  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, i) => (
        <div key={i}>
          {block.label && (
            <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
              <span className="font-body font-bold text-caption uppercase tracking-wide text-text-muted">
                {block.label}
              </span>
              {block.lead && (
                <span className={`font-body font-semibold ${prose} text-ink`}>{block.lead}</span>
              )}
            </div>
          )}
          {block.body && (
            <p className={`${prose} text-slate leading-[1.65] m-0`}>{block.body}</p>
          )}
        </div>
      ))}
    </div>
  );
}
