import { describe, it, expect } from "vitest";
import {
  nextHint,
  hintFor,
  isReady,
  markSeen,
  guideFinished,
  GUIDE_STEPS,
  type GuideState,
} from "@/lib/guide";

/** A brand new account: signed up, done nothing. */
function fresh(over: Partial<GuideState> = {}): GuideState {
  return {
    quotes: 0,
    publishedQuotes: 0,
    acceptedQuotes: 0,
    projects: 0,
    brokenDownDeliverables: 0,
    diaryEntries: 0,
    invoices: 0,
    publishedProjects: 0,
    deliverables: 0,
    doneDeliverables: 0,
    seen: [],
    ...over,
  };
}

describe("nextHint", () => {
  it("starts by pointing at the first quote", () => {
    expect(nextHint(fresh())).toBe("quote");
  });

  it("says one thing at a time", () => {
    // Somebody who signs up and races through three steps in an afternoon
    // should not come back to three stacked hints. The whole point of this
    // returning a single step is that a tour is what it exists to avoid.
    const busy = fresh({
      quotes: 1,
      publishedQuotes: 1,
      acceptedQuotes: 1,
      projects: 1,
    });
    expect(nextHint(busy)).toBe("breakdown");
  });

  it("moves on once a step is seen", () => {
    const state = fresh({ seen: ["quote"] });
    // Nothing else is ready yet, so there is nothing to say at all.
    expect(nextHint(state)).toBeNull();
  });

  it("has nothing to say to an account doing everything", () => {
    const complete = fresh({
      quotes: 3,
      publishedQuotes: 3,
      acceptedQuotes: 2,
      projects: 2,
      publishedProjects: 2,
      brokenDownDeliverables: 8,
      diaryEntries: 4,
      invoices: 1,
    });
    expect(nextHint(complete)).toBeNull();
  });

  it("never returns a step that was already seen", () => {
    const state = fresh({ seen: [...GUIDE_STEPS] });
    expect(nextHint(state)).toBeNull();
  });
});

describe("isReady", () => {
  it("waits for a quote before mentioning publishing", () => {
    expect(isReady("publish", fresh())).toBe(false);
    expect(isReady("publish", fresh({ quotes: 1 }))).toBe(true);
  });

  it("only mentions tracking once a client has accepted", () => {
    // Tracking a quote nobody agreed to is tracking work that may not happen.
    expect(isReady("track", fresh({ quotes: 1, publishedQuotes: 1 }))).toBe(false);
    expect(isReady("track", fresh({ acceptedQuotes: 1 }))).toBe(true);
  });

  it("stops mentioning tracking once something is tracked", () => {
    expect(isReady("track", fresh({ acceptedQuotes: 1, projects: 1 }))).toBe(false);
  });

  it("offers the client page as soon as anything is tracked", () => {
    // Deliberately not waiting for a breakdown. Breaking work into steps is a
    // feature somebody may never use, and gating the client page behind it hid
    // the most distinctive thing in the product from exactly those people.
    expect(isReady("client", fresh())).toBe(false);
    expect(isReady("client", fresh({ projects: 1 }))).toBe(true);
    expect(isReady("client", fresh({ projects: 1, publishedProjects: 1 }))).toBe(false);
  });

  it("asks for an update only once a page exists to put it on", () => {
    expect(isReady("share", fresh({ projects: 1 }))).toBe(false);
    expect(isReady("share", fresh({ projects: 1, publishedProjects: 1 }))).toBe(true);
    expect(
      isReady("share", fresh({ projects: 1, publishedProjects: 1, diaryEntries: 1 }))
    ).toBe(false);
  });

  it("does not mention invoicing before anything has been done", () => {
    expect(isReady("invoice", fresh())).toBe(false);
    expect(isReady("invoice", fresh({ diaryEntries: 1 }))).toBe(true);
    expect(isReady("invoice", fresh({ diaryEntries: 1, invoices: 1 }))).toBe(false);
  });

  it("mentions invoicing the moment the last box is ticked", () => {
    // Somebody who finished the work is owed money, whether or not they ever
    // used the client page.
    expect(isReady("invoice", fresh({ deliverables: 4, doneDeliverables: 3 }))).toBe(false);
    expect(isReady("invoice", fresh({ deliverables: 4, doneDeliverables: 4 }))).toBe(true);
  });
});

describe("hintFor", () => {
  it("only speaks on the screen the hint belongs to", () => {
    // The tracker cannot point at a button on the quote page.
    const state = fresh();
    expect(hintFor("/quote", state)).toBe("quote");
    expect(hintFor("/track", state)).toBeNull();
  });

  it("puts the breakdown hint on a project, not the project list", () => {
    const state = fresh({ acceptedQuotes: 1, projects: 1, quotes: 1, publishedQuotes: 1 });
    expect(hintFor("/track/project", state)).toBe("breakdown");
    expect(hintFor("/quote", state)).toBeNull();
  });

  it("puts the publish hint on the quote itself", () => {
    // Publish is a button on one quote, so pointing at it from the list would
    // point at nothing.
    const state = fresh({ quotes: 1 });
    expect(hintFor("/quote/brief", state)).toBe("publish");
    expect(hintFor("/quote", state)).toBeNull();
  });
});

describe("markSeen", () => {
  it("records a step", () => {
    expect(markSeen([], "quote")).toEqual(["quote"]);
  });

  it("does not record the same step twice", () => {
    // Two tabs, or a double click, should not leave a list that every reader
    // has to deduplicate.
    expect(markSeen(["quote"], "quote")).toEqual(["quote"]);
  });
});

describe("guideFinished", () => {
  it("is false while anything is left", () => {
    expect(guideFinished(fresh({ seen: ["quote"] }))).toBe(false);
  });

  it("is true once every step has been seen", () => {
    expect(guideFinished(fresh({ seen: [...GUIDE_STEPS] }))).toBe(true);
  });
});
