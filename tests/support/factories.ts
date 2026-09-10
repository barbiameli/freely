import type { Prisma, User, Team, Brief, Project } from "@prisma/client";
import { testDb } from "./db";

let seq = 0;

/** A short, collision-free suffix — unique per process, not just per test
 * file, since factories can run inside the same Postgres across files. */
function unique(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Creates a User with the minimum fields Prisma requires, plus sane
 * defaults for the rest. Pass overrides for anything a specific test cares
 * about. */
export function createUser(
  overrides: Partial<Prisma.UserCreateInput> = {}
): Promise<User> {
  return testDb.user.create({
    data: {
      email: `${unique("user")}@example.test`,
      name: "Test Freelancer",
      ...overrides,
    },
  });
}

/** Creates a Team owned by the given User. */
export function createTeam(
  ownerId: string,
  overrides: Partial<Omit<Prisma.TeamCreateInput, "owner">> = {}
): Promise<Team> {
  return testDb.team.create({
    data: {
      name: "Test Studio",
      owner: { connect: { id: ownerId } },
      ...overrides,
    },
  });
}

/** Creates a Quote (the `Brief` model — see CONTEXT.md for why the names
 * differ) belonging to the given User. */
export function createQuote(
  userId: string,
  overrides: Partial<Omit<Prisma.BriefCreateInput, "user">> = {}
): Promise<Brief> {
  return testDb.brief.create({
    data: {
      title: "Test Quote",
      client: "Test Client",
      scope: "Redesign the marketing site",
      deliverables: ["Homepage", "Pricing page"] as Prisma.InputJsonValue,
      timeline: "4 weeks",
      price: 4000,
      hours: 40,
      user: { connect: { id: userId } },
      ...overrides,
    },
  });
}

/**
 * Creates a Client belonging to the given User.
 *
 * `slug` is the internal matching key (lowercased name, see lib/clients) and
 * is unique per user; `publicSlug` is the Client Portal address and is unique
 * globally. Two different things with similar names, so both are set here
 * rather than left to a caller to get right.
 */
export function createClient(
  userId: string,
  overrides: Record<string, unknown> = {}
): Promise<{ id: string; publicSlug: string; name: string; published: boolean }> {
  const name = (overrides.name as string) ?? "Test Client";
  return (
    testDb as unknown as {
      client: {
        create(args: { data: Record<string, unknown> }): Promise<{
          id: string;
          publicSlug: string;
          name: string;
          published: boolean;
        }>;
      };
    }
  ).client.create({
    data: {
      name,
      slug: unique(name.toLowerCase().replace(/[^a-z0-9]+/g, "-")),
      userId,
      ...overrides,
    },
  });
}

/** Creates a file on a Client's Portal. The bytes are not real: nothing in a
 * test talks to blob storage, so `pathname` is just a string. */
export function createDocument(
  clientId: string,
  overrides: Record<string, unknown> = {}
): Promise<{ id: string; name: string; pathname: string }> {
  return (
    testDb as unknown as {
      clientDocument: {
        create(args: { data: Record<string, unknown> }): Promise<{
          id: string;
          name: string;
          pathname: string;
        }>;
      };
    }
  ).clientDocument.create({
    data: {
      clientId,
      name: "brand-guide.pdf",
      pathname: unique("clients/test/brand-guide.pdf"),
      contentType: "application/pdf",
      size: 2048,
      ...overrides,
    },
  });
}

/** Creates a Project (Track's row) belonging to the given User. */
export function createProject(
  userId: string,
  overrides: Partial<Omit<Prisma.ProjectCreateInput, "user">> = {}
): Promise<Project> {
  return testDb.project.create({
    data: {
      title: "Test Project",
      client: "Test Client",
      user: { connect: { id: userId } },
      ...overrides,
    },
  });
}
