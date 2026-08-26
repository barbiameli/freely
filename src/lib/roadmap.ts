/**
 * What is outstanding, what broke, and what was decided.
 *
 * This exists because the answers were living in a chat window. Something
 * deferred in one conversation was rediscovered two conversations later, a bug
 * fixed on Tuesday was reported again on Thursday, and a decision made once got
 * relitigated because nobody could remember the reason. All three are the same
 * failure: the state of the work was not written down anywhere it could be
 * looked at.
 *
 * A list in the repo rather than a table in the database, deliberately.
 *
 * It sits beside the code it describes, so it moves in the same commit as the
 * thing it is describing and cannot drift the way a separate tracker does. It
 * needs no model, no actions and no editing screens, which for a list one
 * person reads would be more app than the problem deserves. And it is in the
 * diff, so "what changed and why" is answered by the same history as the code.
 *
 * The cost is that it is edited here rather than in the browser. That is the
 * right trade while the person reading it and the person changing the code are
 * the same person.
 */

export type ItemKind = "feature" | "bug" | "decision";
export type ItemState = "done" | "next" | "later";

export interface RoadmapItem {
  /** Stable, so an item can be referred to in conversation. */
  id: string;
  kind: ItemKind;
  state: ItemState;
  title: string;
  /**
   * For a feature, what is left. For a bug, what actually caused it. For a
   * decision, why it went that way.
   *
   * The reason matters more than the fact in every one of these cases, which
   * is why there is one field and it is prose rather than a status code.
   */
  note: string;
}

/**
 * Newest first within each state, oldest at the bottom.
 *
 * Order is by hand rather than by date. A date would suggest a schedule, and
 * nothing here has one; what it has is a rough sense of what matters next.
 */
export const ROADMAP: RoadmapItem[] = [
  // Next.
  {
    id: "quote-stream",
    kind: "feature",
    state: "next",
    title: "Show the quote as it is written",
    note: "The two halves now run side by side, which roughly halves the wait. The next step is a streaming endpoint so the core appears the moment it is ready rather than both halves landing together. Bigger change: Server Actions cannot stream.",
  },
  {
    id: "brief-page",
    kind: "feature",
    state: "next",
    title: "Rework the finished quote page",
    note: "Raised a while back and never scoped. Worth deciding what the page is for before touching it: reading a quote, editing one, and sending one are three different jobs sharing one screen.",
  },

  {
    id: "dpa",
    kind: "feature",
    state: "next",
    title: "A Data Processing Agreement",
    note: "The terms page now says what happens to your data. A DPA is the countersignable version, which is what a company evaluating Freely actually asks for. Needs a lawyer's eye before it goes out.",
  },

  // Later.
  {
    id: "country-list",
    kind: "feature",
    state: "later",
    title: "The country list is 42 countries",
    note: "Covers where freelancers quoting in English and Spanish work from. Somewhere missing is a real gap rather than a decision. Adding one is two lines in lib/countries, and the test will refuse a currency the app cannot render a symbol for.",
  },
  {
    id: "insights-translation",
    kind: "feature",
    state: "later",
    title: "Insights is English only",
    note: "Exempt from the client-boundary test because it has one reader, who wrote it. Worth revisiting the moment anybody else is given the address.",
  },

  // Decisions, so they stop being reopened.
  {
    id: "d-stripe-connect",
    kind: "decision",
    state: "done",
    title: "Stripe Connect, with direct charges",
    note: "The client's money goes from the client to the freelancer. Freely is never in the middle and never holds it, which keeps a whole category of regulation out of the product.",
  },
  {
    id: "d-country-not-city",
    kind: "decision",
    state: "done",
    title: "Rates are researched by country, not by city",
    note: "A city is more accurate and there are thousands of them, which no shared cache can hold. Country is the coarsest key that still moves the number.",
  },
  {
    id: "d-suggested-rate",
    kind: "decision",
    state: "done",
    title: "A researched rate is offered, never adopted",
    note: "Three figures to choose from rather than one filled in. There is no single correct rate for a level in a country, and printing one would claim a confidence the research does not have.",
  },
  {
    id: "d-two-lists",
    kind: "decision",
    state: "done",
    title: "Accounts and the mailing list are two cards",
    note: "Storing every account's address is what running the product requires. Writing to one needs consent. Only the consented list has a copy button, so the two cannot be confused at speed.",
  },
  {
    id: "d-one-project-two-tabs",
    kind: "decision",
    state: "done",
    title: "Track and Diary became one project with two tabs",
    note: "They were the same information entered twice. The client page is now derived from the tracker, so it is right the moment a box is ticked and nobody has to write an update.",
  },

  {
    id: "d-no-consent-checkbox",
    kind: "decision",
    state: "done",
    title: "Signup says what accepting means, with no tickbox",
    note: "A compulsory \"I agree\" checkbox produces a click and no knowledge, and adds a step before the thing somebody came for. A sentence next to the button, with a link to the detail, is the honest version.",
  },

  {
    id: "d-invoice-notes",
    kind: "decision",
    state: "done",
    title: "The closing note is chips, not a blank box",
    note: "Everything that belongs at the foot of an invoice is the same every time and none of it is obvious, so the box got left empty and invoices went out with no payment term. Eight lines to tap, all editable underneath. Changing the due date swaps the matching line rather than leaving one the invoice contradicts.",
  },

  {
    id: "d-loading-not-disabled",
    kind: "decision",
    state: "done",
    title: "A working button spins rather than greying out",
    note: "Disabled alone reads as a control that has stopped working, so the second press happens, and the second press is how something gets sent twice. Sixteen buttons converted. Guarded by tests/loading-states, which only flags buttons whose own label already flips on the flag.",
  },

  // Fixed, kept so the same report is recognised rather than re-investigated.
  {
    id: "b-events",
    kind: "bug",
    state: "done",
    title: "Insights died with \"events is not defined\"",
    note: "A local arrow in funnel() closed over its parameter. The production build inlined it and renamed the parameter for the first call only. Correct source, every test passing, broken page. Guarded by tests/metrics-closure.",
  },
  {
    id: "b-quote-validation",
    kind: "bug",
    state: "done",
    title: "\"There was an issue generating quote\"",
    note: "The model returned an empty client name and a min(1) schema discarded the entire quote over it. The schema is tolerant now and gaps are filled after parsing.",
  },
  {
    id: "b-env-missing",
    kind: "bug",
    state: "done",
    title: "\"The table public.RateLimitHit does not exist\"",
    note: "Not the database. .env.production.local is gitignored and had never existed in the second clone, so the schema push had never once run from there.",
  },
  {
    id: "d-quote-split",
    kind: "decision",
    state: "done",
    title: "A quote is written in two calls at once",
    note: "Output tokens are produced one after another, so length is the wait, and most of the length was the add-on sections. None of them depend on the quote, so both halves are written side by side and the wait is the longer one rather than the sum. If the sections fail to parse, the quote survives without them.",
  },
  {
    id: "b-signin-spinner",
    kind: "bug",
    state: "done",
    title: "Sign in stopped spinning before the page arrived",
    note: "setLoading(false) ran before the redirect, so the button said \"Sign in\" again through the longest wait on the screen. Google had no loading state at all.",
  },
  {
    id: "b-terms-contradiction",
    kind: "bug",
    state: "done",
    title: "The terms page looked like it contradicted itself",
    note: "It said invoices are stored and bank details are not, without saying why both are true. The record is a row; the PDF is built at download time and never kept. Now stated.",
  },
  {
    id: "b-coach-anchor",
    kind: "bug",
    state: "done",
    title: "The first hint pointed at the wrong control",
    note: "data-guide=\"quote\" sat on the Generate button, so \"paste what the client sent you\" rang the button at the bottom of the form.",
  },
];

/** Everything still to do, in the order it is worth doing. */
export function outstanding(items: RoadmapItem[] = ROADMAP): RoadmapItem[] {
  const order: ItemState[] = ["next", "later"];
  return items
    .filter((item) => item.state !== "done")
    .sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state));
}

/** Items of one kind, whatever their state. */
export function ofKind(kind: ItemKind, items: RoadmapItem[] = ROADMAP): RoadmapItem[] {
  return items.filter((item) => item.kind === kind);
}

/**
 * How much is left.
 *
 * Counts only what is not done, since a total that grows every time something
 * is fixed is a number nobody wants to look at.
 */
export function remaining(items: RoadmapItem[] = ROADMAP): number {
  return items.filter((item) => item.state !== "done").length;
}
