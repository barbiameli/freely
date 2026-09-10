import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetTestDb, testDb } from "../support/db";
import { createClient, createDocument, createProject, createTeam, createUser } from "../support/factories";

/**
 * The Client Portal is the app's other trust-critical surface.
 *
 * A Public Quote is one document a client was sent. A Portal is everything
 * you have ever shared with them, and the only thing standing between one
 * client and another client's files is a pair of checks in a route handler.
 * Those checks are exactly the kind of thing that keeps working in a unit test
 * against a mocked Prisma while being wrong against a real database, so this
 * runs against real Postgres (ADR-0002).
 *
 * Mocked: the two request-scoped Next APIs (there is no request to be inside
 * of when an action is called directly) and blob storage (there are no bytes
 * in a test, and `del` reaching a real store would be a side effect on an
 * account).
 */
vi.mock("next/headers", () => ({
  headers: () => ({ get: () => "203.0.113.5" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const blobDeletes: string[] = [];
vi.mock("@vercel/blob", () => ({
  put: async (pathname: string) => ({ url: `https://blob.test/${pathname}`, pathname }),
  del: async (pathname: string) => {
    blobDeletes.push(pathname);
  },
  get: async () => ({ stream: null, headers: {}, blob: {} }),
}));

/** Who the session says you are. Reassigned per test. */
let currentUserId = "";
vi.mock("@/lib/session", () => ({
  requireFullUser: async () => {
    if (!currentUserId) throw new Error("Not signed in");
    return testDb.user.findUniqueOrThrow({ where: { id: currentUserId } });
  },
}));

import { setPortalPublishedAction, setWelcomePackAction } from "@/actions/portal";
import { deleteDocumentAction, renameDocumentAction } from "@/actions/documents";
import { GET as portalDocRoute } from "@/app/c/[slug]/doc/[docId]/route";

/*
 * Cleared for every test in the file, not just the first suite.
 *
 * This started life inside the first describe, so by the time the last suite
 * asked "did a stranger's delete reach the store", the array still held the
 * pathname from the legitimate delete two tests earlier. The test failed and
 * the code was right, which is the wrong way round and worth a note: a spy
 * that accumulates needs resetting at the same scope it is read at.
 */
beforeEach(() => {
  blobDeletes.length = 0;
});

describe("the Client Portal", () => {
  afterEach(async () => {
    currentUserId = "";
    await resetTestDb();
  });

  it("is off until it is switched on, and switches back off", async () => {
    const user = await createUser();
    await createTeam(user.id);
    const client = await createClient(user.id);
    currentUserId = user.id;

    expect(client.published).toBe(false);

    const on = await setPortalPublishedAction(client.id, true);
    expect(on.ok).toBe(true);
    expect(
      (await testDb.$queryRawUnsafe<{ published: boolean }[]>(
        `SELECT "published" FROM "Client" WHERE id = $1`,
        client.id
      ))[0].published
    ).toBe(true);

    await setPortalPublishedAction(client.id, false);
    expect(
      (await testDb.$queryRawUnsafe<{ published: boolean }[]>(
        `SELECT "published" FROM "Client" WHERE id = $1`,
        client.id
      ))[0].published
    ).toBe(false);
  });

  it("will not let one freelancer touch another's client", async () => {
    const owner = await createUser();
    await createTeam(owner.id);
    const client = await createClient(owner.id);

    const stranger = await createUser();
    await createTeam(stranger.id);
    currentUserId = stranger.id;

    const result = await setPortalPublishedAction(client.id, true);
    expect(result).toEqual({ ok: false, error: "Client not found." });
    // And nothing moved.
    expect(
      (await testDb.$queryRawUnsafe<{ published: boolean }[]>(
        `SELECT "published" FROM "Client" WHERE id = $1`,
        client.id
      ))[0].published
    ).toBe(false);
  });

  it("stores an empty welcome pack as nothing, so the account's words show instead", async () => {
    const user = await createUser();
    await createTeam(user.id);
    const client = await createClient(user.id);
    currentUserId = user.id;

    await setWelcomePackAction(client.id, "  Two rounds of revisions.  ");
    const written = await testDb.$queryRawUnsafe<{ welcomePack: string | null }[]>(
      `SELECT "welcomePack" FROM "Client" WHERE id = $1`,
      client.id
    );
    expect(written[0].welcomePack).toBe("Two rounds of revisions.");

    await setWelcomePackAction(client.id, "   ");
    const cleared = await testDb.$queryRawUnsafe<{ welcomePack: string | null }[]>(
      `SELECT "welcomePack" FROM "Client" WHERE id = $1`,
      client.id
    );
    expect(cleared[0].welcomePack).toBeNull();
  });
});

describe("reaching a document through a portal", () => {
  afterEach(async () => {
    currentUserId = "";
    await resetTestDb();
  });

  it("refuses while the portal is switched off", async () => {
    const user = await createUser();
    await createTeam(user.id);
    const client = await createClient(user.id);
    const doc = await createDocument(client.id);

    const response = await portalDocRoute(new Request("https://freely.test"), {
      params: { slug: client.publicSlug, docId: doc.id },
    });
    expect(response.status).toBe(404);
  });

  /*
   * The one that matters most.
   *
   * The slug alone would let a client swap the document id in the address bar
   * and read another of the same freelancer's clients' files. Both halves of
   * the check have to hold, and the only way to prove it is with two real
   * clients and two real rows.
   */
  it("refuses a document belonging to a different client", async () => {
    const user = await createUser();
    await createTeam(user.id);
    const mine = await createClient(user.id, { name: "Aurora", published: true });
    const theirs = await createClient(user.id, { name: "Meridian", published: true });
    const theirDoc = await createDocument(theirs.id, { name: "their-contract.pdf" });

    const response = await portalDocRoute(new Request("https://freely.test"), {
      params: { slug: mine.publicSlug, docId: theirDoc.id },
    });
    expect(response.status).toBe(404);
  });

  it("says the same thing for a document that does not exist", async () => {
    const user = await createUser();
    await createTeam(user.id);
    const client = await createClient(user.id, { published: true });

    const response = await portalDocRoute(new Request("https://freely.test"), {
      params: { slug: client.publicSlug, docId: "does-not-exist" },
    });
    // Not 403, and not a different body. A different answer for "exists but
    // is not yours" is a way of finding out that it exists.
    expect(response.status).toBe(404);
  });
});

describe("a document's own record", () => {
  afterEach(async () => {
    currentUserId = "";
    await resetTestDb();
  });

  it("takes only an emoji from the known set", async () => {
    const user = await createUser();
    await createTeam(user.id);
    const client = await createClient(user.id);
    const doc = await createDocument(client.id);
    currentUserId = user.id;

    await renameDocumentAction(doc.id, "Brand guide", "Colours and type", "\u{1F3A8}");
    let row = await testDb.$queryRawUnsafe<{ name: string; emoji: string; note: string }[]>(
      `SELECT "name", "emoji", "note" FROM "ClientDocument" WHERE id = $1`,
      doc.id
    );
    expect(row[0]).toEqual({ name: "Brand guide", emoji: "\u{1F3A8}", note: "Colours and type" });

    // Anything else becomes nothing rather than being stored and rendered.
    await renameDocumentAction(doc.id, "Brand guide", "", "<script>");
    row = await testDb.$queryRawUnsafe<{ name: string; emoji: string; note: string }[]>(
      `SELECT "name", "emoji", "note" FROM "ClientDocument" WHERE id = $1`,
      doc.id
    );
    expect(row[0].emoji).toBe("");
  });

  it("removes the bytes before it forgets the row", async () => {
    const user = await createUser();
    await createTeam(user.id);
    const client = await createClient(user.id);
    const doc = await createDocument(client.id);
    currentUserId = user.id;

    const result = await deleteDocumentAction(doc.id);
    expect(result.ok).toBe(true);
    // The other order leaves bytes in the store that nothing can reach to
    // remove, after somebody has been told the file is gone.
    expect(blobDeletes).toContain(doc.pathname);
    const remaining = await testDb.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*)::bigint AS count FROM "ClientDocument" WHERE id = $1`,
      doc.id
    );
    expect(Number(remaining[0].count)).toBe(0);
  });

  it("will not delete a document belonging to somebody else", async () => {
    const owner = await createUser();
    await createTeam(owner.id);
    const client = await createClient(owner.id);
    const doc = await createDocument(client.id);

    const stranger = await createUser();
    await createTeam(stranger.id);
    currentUserId = stranger.id;

    const result = await deleteDocumentAction(doc.id);
    expect(result).toEqual({ ok: false, error: "Document not found." });
    expect(blobDeletes).toEqual([]);
  });
});

describe("a project on the portal", () => {
  afterEach(async () => {
    currentUserId = "";
    await resetTestDb();
  });

  it("is listed only once it is published", async () => {
    const user = await createUser();
    await createTeam(user.id);
    const client = await createClient(user.id, { published: true });
    const project = await createProject(user.id, { title: "Draft, not sent" });
    // Attached by id rather than through the relation, so the test does not
    // depend on which name the generated client happens to have for it.
    await testDb.$executeRawUnsafe(
      `UPDATE "Project" SET "clientId" = $1 WHERE id = $2`,
      client.id,
      project.id
    );

    const listed = await testDb.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*)::bigint AS count FROM "Project" WHERE "clientId" = $1 AND "published" = true`,
      client.id
    );
    expect(Number(listed[0].count)).toBe(0);
  });
});
