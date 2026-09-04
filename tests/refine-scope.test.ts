import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { keepOnly, keyFor, scopeOf } from "@/lib/refine-scope";

/**
 * Rewriting one section instead of the whole quote.
 *
 * Every refinement used to send the entire document and get an entire one
 * back, so a one-line change to the revisions policy rewrote the scope, the
 * deliverables and the timeline on the way past. That is most of the wait, and
 * it is why a sentence somebody liked could come back different after an
 * instruction about something else.
 *
 * The rule these tests hold: when in doubt, do the slow thing. An instruction
 * that appears to have done nothing is worse than one that took longer.
 */
describe("what an instruction is about", () => {
  it("finds the section when one is clearly named", () => {
    expect(scopeOf("Make it three rounds of revisions")).toBe("revisions");
    expect(scopeOf("Add a cancellation clause")).toBe("terms");
    expect(scopeOf("Change the deposit to 30%")).toBe("paymentTerms");
    expect(scopeOf("Take out the AI disclosure")).toBe("aiUsage");
    expect(scopeOf("Add what the price assumes")).toBe("assumptions");
  });

  it("works in Spanish too", () => {
    expect(scopeOf("Cambia el anticipo al 30%")).toBe("paymentTerms");
    expect(scopeOf("Añade dos rondas de revisiones")).toBe("revisions");
  });

  it("rewrites everything when the instruction is about the document", () => {
    // Tone and length are properties of the whole thing. Scoping one would
    // leave a quote where one section reads differently from the rest.
    expect(scopeOf("Make it shorter")).toBeNull();
    expect(scopeOf("Warmer tone throughout")).toBeNull();
    expect(scopeOf("Rewrite it more simply")).toBeNull();
  });

  it("rewrites everything when two sections are named", () => {
    // Two jobs. Doing one of them is worse than doing both slowly.
    expect(scopeOf("Add a cancellation clause and shorten the timeline")).toBeNull();
    expect(scopeOf("Change the deliverables and the revisions")).toBeNull();
  });

  it("rewrites everything when nothing is named", () => {
    expect(scopeOf("Make this better")).toBeNull();
    expect(scopeOf("")).toBeNull();
  });

  it("does not scope a change to the price", () => {
    // The price rests on the deliverables and the hours, so a scoped rewrite
    // would leave a quote whose parts disagree.
    expect(scopeOf("Make it 3000 instead")).toBeNull();
    expect(scopeOf("Drop the price by 10%")).toBeNull();
  });

  it("reads a loose use of the word scope correctly", () => {
    // "Scope" is a word people use for the section and for the idea, so it
    // only wins when nothing more specific matched.
    expect(scopeOf("Tighten the scope paragraph")).toBe("scope");
    expect(scopeOf("Name what is excluded")).toBe("scopeChanges");
  });

  it("rewrites everything rather than guessing at a loose phrasing", () => {
    // This matched scopeChanges on the words "out of scope" while plainly
    // being about the AI section. Being slow here is the correct answer.
    expect(scopeOf("Take the AI section out of scope")).toBeNull();
  });
});

describe("what comes back", () => {
  it("keeps only the section that was asked for", () => {
    // The model can return more than it was asked for, and a scoped refine
    // that quietly rewrote the deliverables would be invisible.
    const answer = {
      revisions: "Two rounds are included.",
      deliverables: ["something nobody asked to change"],
      price: 9999,
    };
    expect(keepOnly(answer, "revisions")).toEqual({ revisions: "Two rounds are included." });
  });

  it("keeps nothing when the section is missing from the answer", () => {
    expect(keepOnly({ price: 100 }, "revisions")).toEqual({});
  });

  it("maps a scope to the key the quote actually uses", () => {
    expect(keyFor("paymentTerms")).toBe("paymentTerms");
    expect(keyFor("scopeChanges")).toBe("scopeChanges");
  });
});

describe("how refining uses it", () => {
  const source = readFileSync("src/lib/anthropic.ts", "utf8");

  it("asks for one key and says the rest is staying", () => {
    expect(source).toContain("Answer with ONE key only");
    expect(source).toContain("anything else you send will be discarded");
  });

  it("sends the whole quote as context even when rewriting one part", () => {
    // A revisions policy written without sight of the deliverables is a policy
    // about nothing.
    expect(source).toContain("buildRefineUserPrompt(current, refinePrompt, context),");
  });

  it("validates the merged result as a whole quote", () => {
    expect(source).toContain("briefSchema.safeParse(merged)");
  });

  it("falls back to rewriting everything when the narrow answer is unusable", () => {
    expect(source).toContain("if (scoped) return scoped;");
  });

  it("asks for far fewer tokens than a whole rewrite", () => {
    expect(source).toContain("maxTokens: 1500");
    expect(source).toContain("maxTokens: 6000");
  });
});
