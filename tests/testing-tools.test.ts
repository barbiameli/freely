import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The tools that make a first run repeatable.
 *
 * They empty an account, so the thing worth testing about them is that a
 * stranger cannot reach them and that they stop where they say they stop.
 */
const actions = readFileSync("src/actions/testing.ts", "utf8");
const card = readFileSync("src/app/(app)/insights/testing-card.tsx", "utf8");

describe("who can reach them", () => {
  it("checks the admin on the server, not just in the interface", () => {
    expect(actions).toContain("process.env.ADMIN_EMAIL");
    // Hiding a button is not a permission.
    expect((actions.match(/requireAdmin\(\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("fails closed when there is no admin set", () => {
    expect(actions).toMatch(/if \(!admin \|\|/);
  });

  it("says the same thing to a stranger as a missing page would", () => {
    expect(actions).toContain('throw new Error("Not found.")');
  });
});

describe("what they touch", () => {
  it("replaying onboarding clears only the two things that gate it", () => {
    const replay = actions.slice(
      actions.indexOf("export async function replayOnboardingAction"),
      actions.indexOf("export async function resetMyAccountAction")
    );
    expect(replay).toContain("industry: null");
    expect(replay).toContain("guideSeen: []");
    // Nothing is deleted by a replay.
    expect(replay).not.toContain("deleteMany");
  });

  it("resetting deletes what a person made and keeps the login", () => {
    const reset = actions.slice(actions.indexOf("export async function resetMyAccountAction"));
    for (const model of ["brief", "project", "invoice", "memoryAsset"]) {
      expect(reset, model).toContain(`prisma.${model}.deleteMany`);
    }
    // The account row itself is updated, never deleted.
    expect(reset).not.toContain("prisma.user.delete");
  });

  it("leaves the events alone, so the charts keep their history", () => {
    expect(actions).not.toContain("prisma.event.deleteMany");
    expect(actions).toContain("Events are left alone");
  });
});

describe("how it asks", () => {
  it("puts the destructive one behind the shared dialog", () => {
    expect(card).toContain("<Confirm");
    expect(card).toContain("There is no undo");
  });

  it("warns that published links break", () => {
    expect(card).toContain("published quote links will stop working");
  });
});
