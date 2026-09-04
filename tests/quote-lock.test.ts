import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { isLocked, lockMessage, lockReason } from "@/lib/quote-lock";

/**
 * A quote a client has signed is a document they agreed to.
 *
 * Freely let it be rewritten underneath them: refine it, remove a section,
 * change the price, and the page the client bookmarked quietly said something
 * else. Layout pinning already stopped a published quote changing shape; this
 * is the same argument about its contents, and it matters more.
 */
describe("when a quote stops being a draft", () => {
  it("locks once the client has signed", () => {
    expect(lockReason({ acceptedAt: new Date() })).toBe("signed");
    expect(isLocked({ acceptedAt: new Date() })).toBe(true);
  });

  it("locks once it is being tracked as a project", () => {
    // At that point the deliverables, the price and the schedule are what the
    // work is being run against.
    expect(lockReason({ status: "TRACKED" })).toBe("tracked");
  });

  it("leaves a draft alone", () => {
    expect(lockReason({ status: "DRAFT" })).toBeNull();
    expect(lockReason({})).toBeNull();
    expect(isLocked({ acceptedAt: null, status: "DRAFT" })).toBe(false);
  });

  it("says signed when both are true", () => {
    // A freelancer can untrack a project and cannot unsign a client.
    expect(lockReason({ acceptedAt: new Date(), status: "TRACKED" })).toBe("signed");
  });

  it("explains itself differently for each, and offers a way on", () => {
    expect(lockMessage("signed")).toContain("signed");
    expect(lockMessage("tracked")).toContain("tracked");
    for (const reason of ["signed", "tracked"] as const) {
      expect(lockMessage(reason)).toContain("follow-on quote");
    }
  });
});

describe("every path that changes a quote checks", () => {
  const actions = readFileSync("src/actions/briefs.ts", "utf8");

  it("guards refining, editing, sections, extras and the discipline", () => {
    // A rule enforced in four places out of five is a rule that holds until
    // somebody is in a hurry.
    expect(actions.match(/refuseIfLocked\(brief\)/g)?.length).toBe(5);
  });

  it("reads the whole row where it needs to", () => {
    // A narrowing select is how a guard silently stops guarding: acceptedAt
    // would come back undefined and the check would never fire.
    expect(actions).toContain("a narrowing select is how a guard silently stops guarding");
  });
});

describe("the way forward", () => {
  const actions = readFileSync("src/actions/briefs.ts", "utf8");

  it("starts a follow-on rather than editing what was agreed", () => {
    expect(actions).toContain("startFollowOnAction");
  });

  it("carries the decisions they already made once", () => {
    // Same client, rate, payment terms and protection level: asking again
    // would be Freely pretending not to know its own history.
    const block = actions.slice(actions.indexOf("startFollowOnAction"));
    expect(block).toContain("hourlyRate: original.hourlyRate");
    expect(block).toContain("protection: settings.protection");
    expect(block).toContain("followsOnFromId: original.id");
  });

  it("does not re-quote work that has already been agreed", () => {
    const block = actions.slice(actions.indexOf("startFollowOnAction"));
    expect(block).toContain("deliverables: [],");
  });
});

describe("the client gets their copy", () => {
  const acceptance = readFileSync("src/actions/acceptance.ts", "utf8");

  it("emails the address they signed with", () => {
    expect(acceptance).toContain("to: cleanEmail,");
    expect(acceptance).toContain('kind: "QUOTE_COPY"');
  });

  it("sends a link rather than an attachment", () => {
    // The page is the document. A PDF generated here would be a second
    // version of the same thing that could drift from it.
    expect(acceptance).toContain("Open your copy");
    expect(acceptance).toContain("/q/${publicSlug}");
  });

  it("tells them it cannot change from here on", () => {
    expect(acceptance).toContain("It cannot be changed from here on");
  });

  it("never lets a failed send undo an acceptance", () => {
    expect(acceptance).toContain("must not see an error because an");
  });

  it("counts as transactional, since they asked for it by signing", () => {
    const kinds = readFileSync("src/lib/email-kinds.ts", "utf8");
    expect(kinds).toContain("QUOTE_COPY");
    expect(kinds).toContain("they asked for it by signing");
  });
});
