import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildSuggestPrompt,
  mergeSuggestions,
  ruleSuggestions,
  suggestionResponseSchema,
} from "@/lib/suggest-sections";
import { ALL_SECTIONS } from "@/lib/quote-defaults";
import { ruleWords } from "@/lib/rule-words";
import { dict } from "@/lib/i18n";

const title = (rule: Parameters<typeof ruleWords>[0]) => ruleWords(rule, dict("en")).title;

describe("reading the brief before the quote is written", () => {
  it("keeps only sections that exist", () => {
    const merged = mergeSuggestions(
      {
        sections: [
          { key: "includeTimeline", reason: "Three phases with a hard launch date." },
          { key: "includeMagic", reason: "Invented." },
          { key: "includeTerms", reason: "" },
        ],
        sightUnseen: false,
      },
      []
    );
    expect(merged.map((s) => s.key)).toEqual(["includeTimeline"]);
  });

  it("returns them in the canonical order, so the list does not reshuffle", () => {
    const merged = mergeSuggestions(
      {
        sections: [
          { key: "includeAI", reason: "b" },
          { key: "includeStrategy", reason: "a" },
        ],
        sightUnseen: false,
      },
      []
    );
    const order = merged.map((s) => ALL_SECTIONS.indexOf(s.key));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("drops a duplicate rather than listing a section twice", () => {
    const merged = mergeSuggestions(
      {
        sections: [
          { key: "includeTerms", reason: "first" },
          { key: "includeTerms", reason: "second" },
        ],
        sightUnseen: false,
      },
      []
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].reason).toBe("first");
  });
});

describe("the account's own rules", () => {
  it("asks for the sections its rules need", () => {
    const suggested = ruleSuggestions(["assumptions", "revisionRounds"], title);
    expect(suggested.map((s) => s.key).sort()).toEqual([
      "includeAssumptions",
      "includeRevisions",
    ]);
  });

  it("asks for one Terms section rather than two", () => {
    // Cancellation and ownership both live in Terms, and two rules wanting it
    // is still one section.
    const suggested = ruleSuggestions(["cancellation", "ownership"], title);
    expect(suggested).toHaveLength(1);
    expect(suggested[0].key).toBe("includeTerms");
  });

  it("stays quiet about a rule that is switched off", () => {
    expect(ruleSuggestions([], title)).toEqual([]);
  });

  it("wins over the model, and says so with the rule's own words", () => {
    const merged = mergeSuggestions(
      { sections: [{ key: "includeAssumptions", reason: "the model's reason" }], sightUnseen: false },
      ruleSuggestions(["assumptions"], title)
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].rule).toBe("assumptions");
    expect(merged[0].reason).toBe(title("assumptions"));
  });
});

describe("the request", () => {
  it("only ever offers real section keys", () => {
    const { system } = buildSuggestPrompt({ sourceText: "x", language: "English" });
    for (const key of ALL_SECTIONS) expect(system).toContain(key);
  });

  it("caps a long brief rather than sending all of it", () => {
    // This runs while somebody is still typing, so it has to be quick and
    // cheap. The shape of a job is legible in its first pages.
    const { user } = buildSuggestPrompt({
      sourceText: "a".repeat(20000),
      language: "English",
    });
    expect(user.length).toBeLessThan(7000);
  });

  it("asks for the reasons in the quote's language", () => {
    const { system } = buildSuggestPrompt({ sourceText: "x", language: "Spanish" });
    expect(system).toContain("Spanish");
  });

  it("survives a reply that is not the shape it asked for", () => {
    expect(suggestionResponseSchema.safeParse({}).success).toBe(true);
    expect(suggestionResponseSchema.parse({}).sections).toEqual([]);
    expect(suggestionResponseSchema.safeParse({ sections: "no" }).success).toBe(false);
  });
});

describe("how it behaves in the wizard", () => {
  const action = readFileSync("src/actions/suggest.ts", "utf8");
  const wizard = readFileSync("src/app/(app)/quote/quote-wizard.tsx", "utf8");
  const rows = readFileSync("src/components/quote/setup-rows.tsx", "utf8");

  it("never hands the wizard an error to display", () => {
    // An offer nobody asked for should not be able to interrupt somebody
    // halfway through writing a quote.
    expect(action).toContain("const empty = { suggestions: [], sightUnseen: false }");
    expect(action).not.toContain("ok: false");
  });

  it("says nothing about a brief too short to read", () => {
    expect(action).toContain("input.sourceText.trim().length < 120");
  });

  it("does not re-read on every keystroke", () => {
    expect(wizard).toContain("suggestedFrom");
    expect(wizard).toContain("}, 1400);");
  });

  it("offers rather than applies", () => {
    // Nothing is ticked on the freelancer's behalf. The reason is shown next
    // to each one, so taking it is a decision.
    expect(rows).toContain("notTaken");
    expect(rows).toContain("suggestedTakeAll");
  });
});
