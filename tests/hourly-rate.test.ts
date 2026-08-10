import { describe, it, expect } from "vitest";
import { applyHourlyRate } from "@/lib/anthropic";
import type { GeneratedBrief } from "@/lib/anthropic";

const base: GeneratedBrief = {
  title: "Design system rebuild",
  client: "Acme",
  scope: "Scope",
  deliverables: ["A", "B"],
  timeline: "Week 1-2: Discovery - interviews",
  price: 4200,
  hours: 40,
};

describe("applyHourlyRate", () => {
  it("forces price to hours x the stated rate", () => {
    // The bug this exists for: 40/hr, 40 hours, priced at 4200 (105/hr).
    expect(applyHourlyRate(base, 40).price).toBe(1600);
  });

  it("leaves the price alone when it already matches", () => {
    expect(applyHourlyRate({ ...base, price: 1600 }, 40).price).toBe(1600);
  });

  it("leaves hours alone, since that is the part calling for judgment", () => {
    expect(applyHourlyRate(base, 40).hours).toBe(40);
  });

  it("does not touch the price when no rate was given", () => {
    expect(applyHourlyRate(base, 0).price).toBe(4200);
  });

  it("does not touch the price when hours came back as zero", () => {
    expect(applyHourlyRate({ ...base, hours: 0 }, 40).price).toBe(4200);
  });

  it("rounds fractional hours to a whole amount", () => {
    expect(applyHourlyRate({ ...base, hours: 12.5 }, 65).price).toBe(813);
  });
});
