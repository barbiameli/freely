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
