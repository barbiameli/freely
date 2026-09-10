/**
 * The things worth saying to a client before a project starts.
 *
 * A fixed catalogue rather than a blank page, for the same reason the quote
 * form is not a blank page: everybody has to answer these and almost nobody
 * writes them down unprompted. Pick the ones that apply, edit the wording,
 * leave the rest out.
 *
 * Order is fixed and deliberate. It is the order these things actually happen
 * in: hello, sign the thing, here is how I work, here is when I am about, here
 * is where to reach me. A freelancer choosing which blocks to include is
 * making a real choice; choosing what order to say hello in is not, so the
 * interface does not offer it.
 */
export type BlockKind = "welcome" | "contract" | "rules" | "calendar" | "comms";

export interface BlockSpec {
  kind: BlockKind;
  /** What the client sees as the step's heading, before any editing. */
  title: string;
  /** Shown to the freelancer, in the editor, as a starting point. */
  placeholder: string;
  /** Why include this one. Shown small, next to the switch. */
  why: string;
  /** On for a new client, because most people want it. */
  onByDefault: boolean;
}

export const BLOCKS: BlockSpec[] = [
  {
    kind: "welcome",
    title: "Hello",
    placeholder:
      "Glad we are working together. Here is everything you need in one place, and it stays here for the whole project.",
    why: "Sets the tone. One short paragraph is plenty.",
    onByDefault: true,
  },
  {
    kind: "contract",
    title: "Signing",
    placeholder:
      "Before we start there is a contract to sign. It is short. Nothing begins until it is back.",
    why: "The step that quietly holds up week one more than any other.",
    onByDefault: true,
  },
  {
    kind: "rules",
    title: "How I work",
    placeholder:
      "Two rounds of changes per stage. Feedback within two working days keeps us on the date; longer and the date moves with it.",
    why: "The one that stops the argument in week six.",
    onByDefault: true,
  },
  {
    kind: "calendar",
    title: "Meetings",
    placeholder:
      "A short call at the start of each stage, and otherwise whenever you need one. Book a time that suits you rather than waiting for me to offer.",
    why: "Say how often, and who books.",
    onByDefault: false,
  },
  {
    kind: "comms",
    title: "Staying in touch",
    placeholder:
      "Email is best and I reply within a working day. Anything urgent, call. I am not on Slack for this one.",
    why: "One place, so nothing lands somewhere you do not look.",
    onByDefault: false,
  },
];

export function specFor(kind: string): BlockSpec | null {
  return BLOCKS.find((block) => block.kind === kind) ?? null;
}

/** Catalogue order, whatever order the rows came back in. */
export function inCatalogueOrder<T extends { kind: string }>(rows: T[]): T[] {
  const rank = new Map(BLOCKS.map((block, index) => [block.kind as string, index]));
  return rows
    .filter((row) => rank.has(row.kind))
    .sort((a, b) => (rank.get(a.kind) ?? 0) - (rank.get(b.kind) ?? 0));
}
