import { describe, it, expect } from "vitest";
import { parseBriefResponse } from "@/lib/anthropic";

/**
 * A whole generated quote used to be discarded when one text field came back
 * empty. The reply below is the real shape of the one that failed: everything
 * correct, and a brief that never named the client.
 */
const complete = {
  title: "Competitor research and build",
  client: "",
  scope: "Research three competitors, then build the file structure.",
  deliverables: ["Competitor review", "Structured file"],
  timeline: "Week 1: research. Week 2: build.",
  price: 800,
  hours: 20,
};

const reply = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ ...complete, ...over });

describe("parseBriefResponse", () => {
  it("keeps a good quote when the client was never named", () => {
    // The failure this exists for: scope, deliverables, pricing and timeline
    // all correct, a minute of waiting and a paid model call, thrown away over
    // one word the freelancer could have typed in two seconds.
    const brief = parseBriefResponse(reply());
    expect(brief.client).toBe("Client");
    expect(brief.deliverables).toHaveLength(2);
    expect(brief.price).toBe(800);
  });

  it("fills the gap in the language the quote is written in", () => {
    expect(parseBriefResponse(reply(), "es").client).toBe("Cliente");
  });

  it("leaves a real client name alone", () => {
    expect(parseBriefResponse(reply({ client: "Acme" })).client).toBe("Acme");
  });

  it("treats whitespace as missing", () => {
    expect(parseBriefResponse(reply({ client: "   " })).client).toBe("Client");
  });

  it("stands in for a missing title too", () => {
    expect(parseBriefResponse(reply({ title: "" })).title).toBe("Untitled quote");
  });

  it("still refuses a quote with nothing in it", () => {
    // Deliverables are the one thing with no sensible stand-in: a quote that
    // lists no work is not a quote.
    expect(() => parseBriefResponse(reply({ deliverables: [] }))).toThrow();
  });

  it("still reports a reply that was cut off", () => {
    expect(() => parseBriefResponse('{"title": "Half a quote"')).toThrow(/cut off/);
  });
});
