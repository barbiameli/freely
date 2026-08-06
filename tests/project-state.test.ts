import { describe, it, expect } from "vitest";
import { deliverableProgress } from "@/lib/project-state";

describe("deliverableProgress", () => {
  it("returns 0 for a project with no deliverables", () => {
    expect(deliverableProgress([])).toBe(0);
  });

  it("returns 0 when nothing is done", () => {
    expect(deliverableProgress([{ done: false }, { done: false }])).toBe(0);
  });

  it("returns 1 when everything is done", () => {
    expect(deliverableProgress([{ done: true }, { done: true }])).toBe(1);
  });

  it("returns the fraction done for partial progress", () => {
    expect(deliverableProgress([{ done: true }, { done: false }, { done: false }, { done: true }])).toBe(
      0.5
    );
  });
});
