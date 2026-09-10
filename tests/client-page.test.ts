import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { readHistory } from "@/lib/client-read";
import type { ClientHistory } from "@/lib/clients";

function history(over: Partial<ClientHistory> = {}): ClientHistory {
  return {
    quotes: 3,
    won: 2,
    lost: 1,
    typicalAnswerDays: 5,
    typicalPaymentDays: 0,
    overdueInvoices: 0,
    ...over,
  };
}

describe("what the history means", () => {
  it("says nothing it cannot check on a client with no past", () => {
    expect(readHistory(history({ quotes: 0 }))).toEqual(["new"]);
  });

  it("leads with money, because that is what goes wrong expensively", () => {
    const read = readHistory(history({ overdueInvoices: 1, typicalAnswerDays: 1 }));
    expect(read[0]).toBe("overdue");
  });

  it("prefers something overdue now to a pattern of paying late", () => {
    // Both are true; only one needs doing today.
    expect(readHistory(history({ overdueInvoices: 2, typicalPaymentDays: 9 }))).toContain(
      "overdue"
    );
    expect(readHistory(history({ overdueInvoices: 2, typicalPaymentDays: 9 }))).not.toContain(
      "slow"
    );
  });

  it("notices a client who pays on time", () => {
    expect(readHistory(history({ typicalPaymentDays: -2 }))).toContain("reliable");
  });

  it("notices several quotes and nothing won", () => {
    expect(readHistory(history({ quotes: 4, won: 0 }))).toContain("losing");
  });

  it("never says more than three things", () => {
    // A wall nobody reads, and the fourth is always the weakest.
    const busy = readHistory(
      history({ quotes: 5, won: 0, overdueInvoices: 2, typicalAnswerDays: 20 })
    );
    expect(busy.length).toBeLessThanOrEqual(3);
  });

  it("says nothing about a figure it does not have", () => {
    const unknown = readHistory(
      history({ typicalAnswerDays: null, typicalPaymentDays: null })
    );
    expect(unknown).not.toContain("slow");
    expect(unknown).not.toContain("quiet");
    expect(unknown).not.toContain("decisive");
  });
});

describe("the client page", () => {
  const page = readFileSync("src/app/(app)/clients/[clientId]/page.tsx", "utf8");
  const list = readFileSync("src/app/(app)/clients/page.tsx", "utf8");
  const sidebar = readFileSync("src/components/sidebar.tsx", "utf8");

  it("puts the figures above the inference", () => {
    // Somebody deciding whether to trust "ask for a deposit" needs to see the
    // "pays 6 days late" it came from.
    expect(page.indexOf("<StatRow")).toBeLessThan(page.indexOf("readHistory(history)"));
  });

  it("shows their quotes, projects and invoices", () => {
    expect(page).toContain("/track/${project.id}");
    expect(page).toContain("/quote/${quote.id}");
    expect(page).toContain("/invoices/${invoice.id}");
  });

  it("has a way in", () => {
    // The Client record existed for months with no page: the app knew how a
    // client paid and the only way to find out was to write them a quote.
    expect(sidebar).toContain('href: "/clients"');
    expect(list).toContain("clientsForUser");
  });
});

/**
 * The page a client actually lands on.
 *
 * It showed progress and nothing else, so everything a client needed beyond
 * "how is it going" lived in an email thread somebody had to search: the
 * files, the rules, the previous quotes, and how to get twenty minutes of
 * your time.
 */
describe("what a client can reach", () => {
  const page = readFileSync("src/app/p/[slug]/page.tsx", "utf8");
  const actions = readFileSync("src/actions/documents.ts", "utf8");

  it("never lists an unpublished quote", () => {
    // A draft is a number that has not been decided on yet.
    expect(page).toContain("published: true");
  });

  it("shows nothing rather than an empty section", () => {
    expect(page).toContain("documents.length > 0");
    expect(page).toContain("otherQuotes.length > 0");
  });

  it("keeps the store private", () => {
    // A public blob has a URL that resolves forever and cannot be revoked.
    expect(actions).toContain('access: "private"');
    expect(actions).not.toContain('access: "public"');
    // Two clients called Acme would otherwise collide on brand-guide.pdf.
    expect(actions).toContain("addRandomSuffix: true");
  });

  it("lets the bytes out only through a route that checked", () => {
    const clientRoute = readFileSync("src/app/p/[slug]/doc/[docId]/route.ts", "utf8");
    const ownerRoute = readFileSync("src/app/api/documents/[docId]/route.ts", "utf8");

    // The slug alone would let one client read another's files by swapping
    // the id, so the document has to belong to that project's client.
    expect(clientRoute).toContain("id: params.docId, clientId");
    expect(clientRoute).toContain("!project.published");
    // The owner's route is a session and team scope, and works whether or not
    // anything is published.
    expect(ownerRoute).toContain("requireFullUser");
    expect(ownerRoute).toContain("teamScopeWhere(user)");
    // Both answer the same way for missing and forbidden. A different answer
    // is a way of finding out that an id is real.
    expect(ownerRoute).not.toContain("status: 403");
  });

  it("does not let a shared cache hold a document", () => {
    const stream = readFileSync("src/lib/document-stream.ts", "utf8");
    expect(stream).toContain("private, max-age=60");
  });

  it("allows a list of types rather than blocking a list", () => {
    expect(actions).toContain("ALLOWED.includes(file.type)");
    // An uploaded page that runs script on the blob origin.
    expect(actions).not.toContain('"text/html"');
    expect(actions).not.toContain('"image/svg+xml"');
  });

  it("deletes the file before it forgets about it", () => {
    const remove = actions.slice(actions.indexOf("deleteDocumentAction"));
    expect(remove.indexOf("del(row.pathname)")).toBeLessThan(remove.indexOf("table().delete"));
  });

  it("caps what can be uploaded", () => {
    expect(actions).toContain("10 * 1024 * 1024");
  });
});

/**
 * The portal: one client, one link.
 *
 * A client with three jobs used to have three links and three copies of the
 * same brand guide, and no answer to "where do I find that thing you sent me
 * in March".
 */
describe("the client portal", () => {
  const page = readFileSync("src/app/c/[slug]/page.tsx", "utf8");
  const route = readFileSync("src/app/c/[slug]/doc/[docId]/route.ts", "utf8");
  const actions = readFileSync("src/actions/portal.ts", "utf8");
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  it("is unguessable and off by default", () => {
    const client = schema.slice(schema.indexOf("model Client"));
    // Whitespace-insensitive: prisma format and a hand edit both move the
    // columns around, and the assertion is about the constraints.
    const head = client.slice(0, 1400).replace(/[ \t]+/g, " ");
    expect(head).toContain("publicSlug String @unique @default(cuid())");
    expect(head).toContain("published Boolean @default(false)");
  });

  it("says the same thing for missing and switched off", () => {
    expect(page).toContain("!client || !client.published");
    expect(route).toContain("!client || !client.published");
  });

  it("lists only published projects", () => {
    expect(page).toContain("published: true");
  });

  it("cannot be written to", () => {
    // No form and no action import: the only thing a visitor can do is look.
    expect(page).not.toContain('"use client"');
    expect(page).not.toContain("@/actions/");
  });

  it("falls back to the account's words when a client has none", () => {
    expect(page).toContain("client.welcomePack || extras?.clientNotes");
  });

  it("keeps the emoji to a known set", () => {
    const docs = readFileSync("src/actions/documents.ts", "utf8");
    expect(docs).toContain("DOCUMENT_EMOJI.includes(emoji) ? emoji : \"\"");
  });

  it("switches off without deleting anything", () => {
    expect(actions).toContain("setPortalPublishedAction");
    expect(actions).not.toContain("delete(");
  });
});
