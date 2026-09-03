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

describe("where it is used", () => {
  const plan = readFileSync("src/lib/quote-plan.ts", "utf8");
  const action = readFileSync("src/actions/plan.ts", "utf8");

  it("merges the model's reading with the account's rules, in the plan step", () => {
    // This used to run twice: once in a panel inside the form, before
    // anything had read the brief, and once after. The blind one went.
    expect(action).toContain("mergeSuggestions(");
    expect(action).toContain("ruleSuggestions(");
  });

  it("plans the sections after the brief has been read", () => {
    expect(plan).toContain('"sections" names the parts of the quote worth carrying');
  });
});
