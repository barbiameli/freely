import { describe, it, expect, vi } from "vitest";

// The templates reach a server action through the acceptance block, which
// reaches Prisma. Rendering markup should not open a database connection, and
// in CI it cannot: there is no engine for this platform.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@prisma/client", () => ({ PrismaClient: class {}, Prisma: { JsonNull: null } }));
import { renderToStaticMarkup } from "react-dom/server";
import {
  ClassicTemplate,
  EditorialTemplate,
  MinimalTemplate,
  MonoTemplate,
  type PublicBrief,
} from "@/app/q/[slug]/templates";

/**
 * The four templates, actually rendered.
 *
 * Every other test here reads the source and asserts something about the text
 * of it. These run the components, which is the only way to catch the class of
 * bug where a grouped quote renders fine in the file and throws on the page:
 * an index that is not there, a currency that is null, a milestone naming a
 * deliverable somebody deleted.
 *
 * The published page is the one screen in the product a stranger sees without
 * being able to refresh it or ask what happened.
 */
const BASE: PublicBrief = {
  title: "Rebrand",
  client: "A roaster",
  scope: "Scope prose, two sentences long. And a second one.",
  deliverables: ["Audit", "Wireframes: six core screens", "Front end", "Handover"],
  timeline: "Week 1: start\nWeek 2: finish",
  strategy: null,
  price: 5000,
  hours: 80,
  currency: "GBP",
  language: "en",
  examples: [],
  slug: "abc",
  signable: false,
};

const MILESTONES = [
  { name: "Discovery", deliverableIndexes: [0, 1], gate: "Wireframes signed off", amount: 1500 },
  { name: "Build", deliverableIndexes: [2], amount: 3500 },
];

const BRAND = { primary: "#F45B69", accent: "#6320EE" };

const TEMPLATES: [string, (brief: PublicBrief) => JSX.Element][] = [
  ["classic", (brief) => <ClassicTemplate brief={brief} brand={BRAND} />],
  ["editorial", (brief) => <EditorialTemplate brief={brief} brand={BRAND} />],
  ["minimal", (brief) => <MinimalTemplate brief={brief} brand={BRAND} />],
  ["mono", (brief) => <MonoTemplate brief={brief} dark={false} />],
];

describe("every template renders", () => {
  for (const [name, render] of TEMPLATES) {
    it(`${name}: a plain quote`, () => {
      const html = renderToStaticMarkup(render(BASE));
      expect(html).toContain("Audit");
      expect(html).toContain("Handover");
    });

    it(`${name}: grouped under milestones`, () => {
      const html = renderToStaticMarkup(
        render({ ...BASE, milestones: MILESTONES, layout: 2 })
      );
      expect(html).toContain("Discovery");
      expect(html).toContain("Build");
      // The one deliverable no milestone claims still appears.
      expect(html).toContain("Also included");
      expect(html).toContain("Handover");
      expect(html).toContain("Invoiced on completion");
    });

    /**
     * The promise: a quote a client already has does not change shape. Same
     * data, version 1, must produce what it always produced.
     */
    it(`${name}: version 1 ignores the milestones entirely`, () => {
      const before = renderToStaticMarkup(render(BASE));
      const after = renderToStaticMarkup(render({ ...BASE, milestones: MILESTONES, layout: 1 }));
      expect(after).toBe(before);
    });

    it(`${name}: a milestone naming a deliverable that was deleted`, () => {
      const html = renderToStaticMarkup(
        render({
          ...BASE,
          layout: 2,
          milestones: [{ name: "Ghost", deliverableIndexes: [9, 0], amount: 5000 }],
        })
      );
      expect(html).toContain("Ghost");
      expect(html).toContain("Audit");
    });

    it(`${name}: no currency, no hourly rate, no extras`, () => {
      const html = renderToStaticMarkup(
        render({ ...BASE, currency: null, hourlyRate: null, extras: null, layout: 2, milestones: MILESTONES })
      );
      expect(html).toContain("Discovery");
    });

    it(`${name}: the freelancer's own payment terms replace the default note`, () => {
      const html = renderToStaticMarkup(
        render({
          ...BASE,
          layout: 2,
          milestones: MILESTONES,
          extras: { paymentTerms: "Half up front, half on delivery." },
        })
      );
      expect(html).toContain("Half up front");
      expect(html).not.toContain("Invoiced on completion");
    });
  }
});
