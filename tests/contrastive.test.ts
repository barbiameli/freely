import { describe, it, expect } from "vitest";
import { stripContrastive } from "@/lib/sanitize-text";

/**
 * The two sentences that prompted this are the first two cases: both came out
 * of a real generated quote, and both say the whole thing before the comma.
 */
describe("stripContrastive", () => {
  it("drops the tail from the sentences that prompted it", () => {
    expect(
      stripContrastive(
        "Existing screens are in Adobe XD, which Figma does not import cleanly, these are best used as visual reference only, not as a foundation to build on."
      )
    ).toBe(
      "Existing screens are in Adobe XD, which Figma does not import cleanly, these are best used as visual reference only."
    );

    expect(
      stripContrastive(
        "Accessibility has not been considered so far, and this needs to be addressed in the design phase, not after."
      )
    ).toBe(
      "Accessibility has not been considered so far, and this needs to be addressed in the design phase."
    );
  });

  it("drops 'rather than' tails too", () => {
    expect(stripContrastive("Agree the direction first, rather than after design starts.")).toBe(
      "Agree the direction first."
    );
  });

  it("leaves a mid-sentence 'not' alone", () => {
    // The comma here belongs to "which", so there is no contrastive tail to cut.
    const text = "The core feature is not fully defined yet, which means design cannot start there.";
    expect(stripContrastive(text)).toBe(text);
  });

  it("leaves sentences with no contrast untouched", () => {
    const text = "The pitch deck is the most useful asset right now.";
    expect(stripContrastive(text)).toBe(text);
  });

  it("handles several sentences in one string", () => {
    expect(
      stripContrastive(
        "Map every step to checkout, not just the happy path. Then review it with the client, rather than signing off alone."
      )
    ).toBe("Map every step to checkout. Then review it with the client.");
  });

  it("does not leave a space before the full stop", () => {
    expect(stripContrastive("Use it as reference only , not as a base.")).not.toContain(" .");
  });

  it("is safe to run twice", () => {
    const once = stripContrastive("Best used as reference only, not as a foundation.");
    expect(stripContrastive(once)).toBe(once);
  });
});
