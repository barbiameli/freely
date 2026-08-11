import { describe, it, expect } from "vitest";
import {
  splitDeliverable,
  paragraphs,
  tidyTitle,
  summaryRepeatsTitle,
  splitLabelled,
  updateBlocks,
} from "@/lib/rich-text";
import { toggleExampleLine } from "@/lib/quote-prompts";

describe("splitDeliverable", () => {
  it("separates the name from what it covers", () => {
    const { lead, detail } = splitDeliverable(
      "Token foundations, colour, spacing, radius, shadow, and motion values set up as Variables in Figma"
    );
    expect(lead).toBe("Token foundations");
    expect(detail).toContain("colour, spacing");
  });

  it("splits on a colon too", () => {
    const { lead, detail } = splitDeliverable(
      "Developer handoff: a finalised Figma file with a named handoff page and a token export"
    );
    expect(lead).toBe("Developer handoff");
    expect(detail).toContain("finalised Figma file");
  });

  it("leaves a short name whole", () => {
    expect(splitDeliverable("Wireframes").detail).toBe("");
  });

  it("leaves it whole when the lead is itself a sentence", () => {
    const text = "We will audit the current system. Then rebuild the pieces that are worth keeping.";
    expect(splitDeliverable(text).detail).toBe("");
  });

  it("leaves it whole when the lead is too long to be a name", () => {
    const text =
      "A very long opening clause that runs on well past the point of being any kind of name at all, then some detail";
    expect(splitDeliverable(text).detail).toBe("");
  });

  it("leaves it whole when what follows is too short to be worth splitting", () => {
    expect(splitDeliverable("Component library, phase 2").detail).toBe("");
  });
});

describe("paragraphs", () => {
  it("respects line breaks the model wrote", () => {
    expect(paragraphs("First part.\n\nSecond part.")).toEqual(["First part.", "Second part."]);
  });

  it("breaks a long run of prose into groups of sentences", () => {
    const long =
      "The current design system is fragmented across three files. " +
      "Components have drifted from what is in production. " +
      "The team rebuilds buttons from scratch on every sprint. " +
      "This project consolidates them into one source of truth. " +
      "Everything is named to match the React codebase so nothing needs translating. " +
      "The result is one library the whole team works from rather than three that disagree.";
    const out = paragraphs(long);
    expect(out.length).toBeGreaterThan(1);
    expect(out.join(" ")).toBe(long.trim());
  });

  it("leaves short text as one paragraph", () => {
    expect(paragraphs("A short scope.")).toEqual(["A short scope."]);
  });

  it("does not break on decimals or abbreviations", () => {
    const text = "Rates sit around 3.5x the baseline, e.g. the usual agency markup, which matters.";
    expect(paragraphs(text, 10)).toEqual([text]);
  });

  it("never returns nothing", () => {
    expect(paragraphs("   ")).toEqual([""]);
  });
});

describe("toggleExampleLine", () => {
  it("adds a line", () => {
    expect(toggleExampleLine("", "Price this fixed", true)).toBe("Price this fixed");
  });

  it("appends to what is already written", () => {
    expect(toggleExampleLine("My own note", "Price this fixed", true)).toBe(
      "My own note\nPrice this fixed"
    );
  });

  it("does not add the same line twice", () => {
    // The bug: clicking an example twice put the same sentence in twice.
    const once = toggleExampleLine("", "Price this fixed", true);
    expect(toggleExampleLine(once, "Price this fixed", true)).toBe(once);
  });

  it("removes exactly that line and leaves the rest", () => {
    const text = "My own note\nPrice this fixed\nSplit into milestones";
    expect(toggleExampleLine(text, "Price this fixed", false)).toBe(
      "My own note\nSplit into milestones"
    );
  });

  it("leaves a line that was edited by hand, rather than deleting someone's writing", () => {
    const text = "Price this fixed, but only for phase one";
    expect(toggleExampleLine(text, "Price this fixed", false)).toBe(text);
  });

  it("comes back empty when the only line is removed", () => {
    expect(toggleExampleLine("Price this fixed", "Price this fixed", false)).toBe("");
  });
});

describe("tidyTitle", () => {
  it("keeps a title that is already short", () => {
    expect(tidyTitle("Token foundations")).toBe("Token foundations");
  });

  it("cuts a whole sentence back to its leading clause", () => {
    // The bug: the model returned the full client-facing sentence as the
    // title, so the heading wrapped to three lines.
    expect(
      tidyTitle(
        "Token foundations, colour, spacing, radius, shadow, and motion values set up as Variables in Figma"
      )
    ).toBe("Token foundations");
  });

  it("strips trailing punctuation", () => {
    expect(tidyTitle("Developer handoff:")).toBe("Developer handoff");
  });

  it("cuts on a word boundary when there is no clause to fall back on", () => {
    const long =
      "Map every step from landing page to checkout confirmation and deliver a prioritised fix list";
    const out = tidyTitle(long, 40);
    expect(out.length).toBeLessThanOrEqual(43);
    expect(out.endsWith("...")).toBe(true);
    expect(out).not.toMatch(/\s\.\.\.$/);
  });

  it("takes only the first line", () => {
    expect(tidyTitle("Research phase\nand then some other text")).toBe("Research phase");
  });
});

describe("splitLabelled", () => {
  it("pulls a week label off a plan paragraph", () => {
    const { label, lead, body } = splitLabelled(
      "Week 1: Audit and access - you share login access to the site backend and analytics, I review every step from landing page to order confirmation."
    );
    expect(label).toBe("Week 1");
    expect(lead).toBe("Audit and access");
    expect(body).toContain("you share login access");
  });

  it("handles a week range", () => {
    const { label } = splitLabelled("Week 2-3: Checkout and mobile fixes - redesign the flow.");
    expect(label).toBe("Week 2-3");
  });

  it("handles the Spanish stage words", () => {
    const { label, lead } = splitLabelled(
      "Semana 1: Auditoría y acceso - revisamos cada paso del sitio."
    );
    expect(label).toBe("Semana 1");
    expect(lead).toBe("Auditoría y acceso");
  });

  it("leaves an ordinary paragraph alone", () => {
    const text = "Kicking off the project, excited to get started.";
    expect(splitLabelled(text)).toEqual({ label: "", lead: "", body: text });
  });

  it("does not treat an unrelated colon as a stage label", () => {
    const text = "Note: this covers phase one only.";
    expect(splitLabelled(text).label).toBe("");
  });

  it("keeps the lead in the body when it reads as a full sentence", () => {
    const { label, lead, body } = splitLabelled(
      "Week 4: This covers the whole visual refresh across every page in the app."
    );
    expect(label).toBe("Week 4");
    expect(lead).toBe("");
    expect(body).toContain("visual refresh");
  });
});

describe("updateBlocks", () => {
  it("splits a run-on kick-off update into one block per stage", () => {
    const text =
      "Kicking off E-commerce UX Overhaul, excited to get started. Here's what's ahead: " +
      "Week 1: Audit and access - you share login access to the site backend and analytics, I review every step from landing page to order confirmation, map where people drop off and why, and deliver the audit report for your sign-off before any design work starts. " +
      "Week 2-3: Checkout and mobile fixes - redesign the checkout flow with early delivery cost visibility, simplify the cart-to-payment path, and rebuild the mobile layouts for home, product, and cart pages. Needs your feedback on the checkout direction before visuals are finalised.";
    const blocks = updateBlocks(text);
    expect(blocks.length).toBeGreaterThanOrEqual(3);
    expect(blocks[0].label).toBe("");
    expect(blocks[1].label).toBe("Week 1");
    expect(blocks[1].lead).toBe("Audit and access");
    expect(blocks[2].label).toBe("Week 2-3");
    expect(blocks[2].lead).toBe("Checkout and mobile fixes");
  });

  it("still works on a plain update with no stages", () => {
    const blocks = updateBlocks("Checkout flow redesigned, ready for your review.");
    expect(blocks).toEqual([{ label: "", lead: "", body: "Checkout flow redesigned, ready for your review." }]);
  });
});

describe("summaryRepeatsTitle", () => {
  it("catches a summary that is the title again", () => {
    // What Barbara saw: the same sentence printed twice, once as the heading
    // and once as the summary under it.
    const line =
      "Map every step from landing page to checkout confirmation on the site and deliver a fix list";
    expect(summaryRepeatsTitle(line, line)).toBe(true);
  });

  it("catches a summary that opens with the title", () => {
    expect(summaryRepeatsTitle("Token foundations set up as Variables", "Token foundations")).toBe(
      true
    );
  });

  it("keeps a summary that says something new", () => {
    expect(
      summaryRepeatsTitle(
        "Translate whatever token values exist today into a linked collection the devs can read",
        "Token foundations"
      )
    ).toBe(false);
  });

  it("handles an empty summary", () => {
    expect(summaryRepeatsTitle("", "Token foundations")).toBe(false);
  });
});
