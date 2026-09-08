import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

/**
 * The board is what somebody came to this page for.
 *
 * It was fifth: the header, five stat cards at 19px, a full-width tracker
 * card, a full-width schedule bar, then what was coming up, and only then the
 * work. Every one of those is a glance and the board is the thing you use, so
 * the page was ordered by what was built first rather than by what is looked
 * at.
 */
const detail = readFileSync("src/app/(app)/track/[projectId]/project-detail.tsx", "utf8");
const stats = readFileSync("src/components/track/stat-row.tsx", "utf8");
const timer = readFileSync("src/components/track/timer-button.tsx", "utf8");
const css = readFileSync("src/app/globals.css", "utf8");

describe("what sits above the board", () => {
  it("puts the clock in the header rather than a band of its own", () => {
    const header = detail.slice(detail.indexOf("<RecordHeader"), detail.indexOf("<StatRow"));
    expect(header).toContain("TimerButton");
  });

  it("keeps the panel, below the board", () => {
    // Still there to be read: the week, the log, the calendar import. Just
    // not between the numbers and the work.
    expect(detail.indexOf("<TimePanel")).toBeGreaterThan(detail.indexOf("t.track.deliverables"));
  });

  it("puts the schedule and what is coming up on one row", () => {
    expect(detail).toContain("lg:grid-cols-[1.5fr_1fr]");
  });

  it("shrinks the figures, which are a glance", () => {
    expect(stats).not.toContain("text-[19px]");
    expect(stats).toContain("text-[15px]");
  });
});

describe("the timer asks once", () => {
  it("breathes on arrival and stops", () => {
    // Anything that pulses forever becomes furniture.
    expect(timer).toContain("animate-pulse-once");
    expect(css).toContain("animation: pulse-once 1.15s ease-in-out 3;");
  });

  it("stops asking once it is running", () => {
    // It has what it wanted at that point.
    const running = timer.slice(timer.indexOf("running\n          ?"));
    expect(running.slice(0, 200)).toContain("bg-ink text-white");
  });

  it("respects somebody who asked for less motion", () => {
    expect(css).toContain("prefers-reduced-motion: reduce");
    const guard = css.slice(css.lastIndexOf("prefers-reduced-motion: reduce"));
    // Covered by the blanket rule rather than by being named, so the pulse
    // cannot fall out of the guard the next time this file is edited.
    expect(guard).toContain("animation: none !important");
    expect(css).toContain(".animate-pulse-once");
  });

  it("asks what the tracking is for before starting a clock", () => {
    // Otherwise the first press records time against nothing.
    expect(timer).toContain("if (!setUp)");
    expect(timer).toContain("onSetUp()");
  });
});

describe("the rail's icons", () => {
  const sidebar = readFileSync("src/components/sidebar.tsx", "utf8");

  it("draws no box around them", () => {
    // Five rounded outlines down the rail made the icons the small thing
    // inside them. The icon is the thing.
    expect(sidebar).not.toContain('"border border-line"');
    expect(sidebar).toContain("bg-transparent");
  });

  it("makes them big enough to read as pictures", () => {
    expect(sidebar).toContain("size={22}");
  });

  it("grows them under the pointer", () => {
    expect(sidebar).toContain("group-hover:scale-110");
    expect(sidebar).toContain("motion-reduce:transition-none");
  });
});

describe("the page starts where the rail starts", () => {
  const shell = readFileSync("src/app/(app)/layout.tsx", "utf8");
  const detail = readFileSync("src/app/(app)/track/[projectId]/project-detail.tsx", "utf8");

  it("does not leave a band of nothing above every heading", () => {
    // The rail's logo sits at 28px and the content began at 40px, so every
    // page started below its own navigation.
    expect(shell).not.toContain("md:py-10");
    expect(shell).toContain("md:pt-7");
  });

  it("does not spend a row on a bell and an avatar", () => {
    // It was rendered at the top of fourteen pages, so every screen began
    // with a band containing a bell and an avatar directly above its own
    // heading. One copy, in the shell.
    expect(detail).not.toContain("<Topbar />");
    const shell = readFileSync("src/app/(app)/layout.tsx", "utf8");
    expect(shell).toContain("<Topbar />");
  });

  it("keeps them top right, where people look for their own account", () => {
    // They spent a spell in the rail, which reclaimed the row and made them
    // harder to find: a rail is where you look for navigation.
    const shell = readFileSync("src/app/(app)/layout.tsx", "utf8");
    expect(shell).toContain("flex justify-end");
    const sidebar = readFileSync("src/components/sidebar.tsx", "utf8");
    expect(sidebar).not.toContain("<Topbar />");
  });

  it("does not sit under the page's own content", () => {
    // A negative margin pulled it up over the page to buy back the row it
    // costs, which works until a page starts with something full width and
    // then the content covers the bell. A control you cannot click is worse
    // than one that costs forty pixels.
    const shell = readFileSync("src/app/(app)/layout.tsx", "utf8");
    expect(shell).not.toContain("-mb-9");
    expect(shell).toContain("sticky top-0 z-30");
  });
});

/**
 * One order for the top of every page.
 *
 * The pieces were all there and each page arranged them differently: Quote put
 * its tabs above the title, Invoices put them after the header at the column's
 * own gap, Memory put them after it and then pulled the hint back up with a
 * negative margin, and the Quote list tab had no title at all. Four pages, four
 * answers, which reads as four products.
 *
 * Title, then the line under it, then the tabs, then the content. The tab strip
 * belongs to the header, so it goes in the header's `below` slot.
 */
describe("the top of a page", () => {
  const views = [
    "src/app/(app)/quote/quote-wizard.tsx",
    "src/app/(app)/invoices/invoices-view.tsx",
    "src/app/(app)/memory/memory-view.tsx",
  ];

  it("puts every tab strip inside the header", () => {
    for (const view of views) {
      const lines = readFileSync(view, "utf8").split("\n");
      // A tab strip is in the right place when the text just before it opens
      // the header's `below` slot. Anything else is a strip rendered as a
      // sibling of the header, above or below it.
      const stray = lines.filter((line, index) => {
        if (!/^\s*<(Quote)?Tabs[\s/>]/.test(line)) return false;
        const previous = (lines[index - 1] ?? "").trim();
        return !previous.endsWith("below={") && !previous.endsWith("<>");
      });
      expect({ view, stray }).toEqual({ view, stray: [] });
    }
  });

  it("gives the quote list a title of its own", () => {
    const wizard = readFileSync("src/app/(app)/quote/quote-wizard.tsx", "utf8");
    expect(wizard).toContain("t.quote.allTitle");
  });

  it("does not undo the column gap with a negative margin", () => {
    for (const view of views) {
      expect({ view, pull: readFileSync(view, "utf8").includes('className="text-small text-slate -mt-3"') }).toEqual({
        view,
        pull: false,
      });
    }
  });
});

/**
 * The schedule and what is coming up, at one height.
 *
 * They sat side by side at their own natural heights, and the schedule was the
 * taller of the two by a wide margin: it gave Reschedule a full line of its own
 * above everything else. So the row read as one card with something small
 * tacked on beside it.
 */
describe("the row above the board", () => {
  const detail = readFileSync("src/app/(app)/track/[projectId]/project-detail.tsx", "utf8");

  it("stretches both cards to the row", () => {
    expect(detail).toContain("items-stretch");
    expect(detail).not.toContain("lg:grid-cols-[1.5fr_1fr] gap-4 items-start");
    expect(readFileSync("src/components/track/coming-up.tsx", "utf8")).toContain("py-3.5 h-full");
  });

  it("puts reschedule on the count's line", () => {
    const bar = readFileSync("src/components/track/timeline-bar.tsx", "utf8");
    expect(bar).toContain("action?: ReactNode;");
    expect(detail).toContain("action={");
    // The row that held nothing but that one button.
    expect(detail).not.toContain('<div className="flex items-baseline justify-end mb-1">');
  });
});
