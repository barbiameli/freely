import { describe, it, expect } from "vitest";
import {
  scanBrandGuide,
  scanIsComplete,
  colours,
  fontFor,
  isBrandColour,
  normaliseHex,
} from "@/lib/brand-scan";

describe("normaliseHex", () => {
  it("expands shorthand", () => {
    expect(normaliseHex("#abc")).toBe("#AABBCC");
  });

  it("settles on one spelling", () => {
    expect(normaliseHex("#6320ee")).toBe(normaliseHex("#6320EE"));
  });
});

describe("isBrandColour", () => {
  it("rejects the page furniture", () => {
    // Every guide prints these in its type rules. Handing one back as somebody's
    // brand colour would silently restyle their quotes.
    expect(isBrandColour("#FFFFFF")).toBe(false);
    expect(isBrandColour("#000000")).toBe(false);
    expect(isBrandColour("#F4F4F4")).toBe(false);
  });

  it("accepts a colour somebody chose", () => {
    expect(isBrandColour("#6320EE")).toBe(true);
    expect(isBrandColour("#FF5A36")).toBe(true);
  });
});

describe("colours", () => {
  it("keeps the document's order", () => {
    // First printed is the primary in every guide I have seen, and reordering
    // by anything else would be inventing a ranking.
    const text = "Primary #6320EE. Accent #FF5A36.";
    expect(colours(text)).toEqual(["#6320EE", "#FF5A36"]);
  });

  it("says the same colour once", () => {
    expect(colours("#6320EE and again #6320ee")).toEqual(["#6320EE"]);
  });

  it("steps over the greys to find the real ones", () => {
    const text = "Text #000000 on #FFFFFF. Brand: #6320EE, #FF5A36.";
    expect(colours(text)).toEqual(["#6320EE", "#FF5A36"]);
  });
});

describe("fontFor", () => {
  it("reads a colon", () => {
    expect(fontFor("Heading font: Raleway", ["heading"])).toBe("Raleway");
  });

  it("reads a dash", () => {
    expect(fontFor("Headline typeface — Inter", ["headline"])).toBe("Inter");
  });

  it("reads a sentence", () => {
    expect(fontFor("Body type is Georgia", ["body"])).toBe("Georgia");
  });

  it("keeps a two-word name whole", () => {
    expect(fontFor("Body font: Helvetica Neue", ["body"])).toBe("Helvetica Neue");
  });

  it("has nothing to say when the guide does not", () => {
    expect(fontFor("Use something friendly and modern", ["heading"])).toBeNull();
  });

  it("does not mistake a table header for a typeface", () => {
    expect(fontFor("Heading: Body", ["heading"])).toBeNull();
  });
});

describe("scanBrandGuide", () => {
  it("reads an explicit guide without asking anyone", () => {
    const text = [
      "Brand guidelines",
      "Primary colour: #6320EE",
      "Accent colour: #FF5A36",
      "Heading font: Raleway",
      "Body font: Inter",
    ].join("\n");
    const scan = scanBrandGuide(text);
    expect(scan).toEqual({
      primaryColor: "#6320EE",
      accentColor: "#FF5A36",
      headingFont: "Raleway",
      bodyFont: "Inter",
    });
    expect(scanIsComplete(scan)).toBe(true);
  });

  it("uses one stated typeface for both", () => {
    // "We use Inter for everything" is the most common typography section
    // there is, and it answers both questions.
    const scan = scanBrandGuide("Colours #6320EE and #FF5A36. Body font: Inter");
    expect(scan.headingFont).toBe("Inter");
    expect(scan.bodyFont).toBe("Inter");
    expect(scanIsComplete(scan)).toBe(true);
  });

  it("leaves prose to the model", () => {
    const scan = scanBrandGuide(
      "Our palette is warm and earthy, and we set type in something with character."
    );
    expect(scan.primaryColor).toBeNull();
    expect(scanIsComplete(scan)).toBe(false);
  });

  it("is incomplete on a partial guide rather than half right", () => {
    // Three of four still costs a call, so there is no saving in pretending
    // this one is done.
    const scan = scanBrandGuide("Primary #6320EE. Heading font: Raleway.");
    expect(scan.accentColor).toBeNull();
    expect(scanIsComplete(scan)).toBe(false);
  });

  it("survives an empty document", () => {
    expect(scanIsComplete(scanBrandGuide(""))).toBe(false);
  });
});
