/**
 * The guided tour, decided rather than scheduled.
 *
 * A tour that fires all five of its steps on day one teaches nothing. Being
 * told how to publish a client page before you have a quote to publish is
 * noise, and it arrives at the exact moment somebody is trying to do the one
 * thing they came for.
 *
 * So there is no tour. There are five hints, each with a condition that has to
 * be true about the account, and at most one can be showing. The condition is
 * always "you are now at this point and have not done the next thing yet",
 * which means a hint appears the first time it could possibly be useful and
 * never afterwards.
 *
 * Two rules keep it from being annoying:
 *
 * Seen once is seen. Dismissing a hint, or doing the thing it asked for, ends
 * it permanently. Nothing here reappears.
 *
 * One at a time, in order. Somebody who signs up, generates a quote and tracks
 * it in five minutes gets the tracking hint, not three hints stacked up.
 */

/** The five moments, in the order somebody reaches them. */
export const GUIDE_STEPS = [
  "quote",
  "publish",
  "track",
  "breakdown",
  "client",
  "invoice",
] as const;

export type GuideStep = (typeof GUIDE_STEPS)[number];

/**
 * What the account has actually done.
 *
 * Counts rather than booleans, because "has any quote" and "has three quotes"
 * are different situations and a count keeps the option of using that later.
 */
export interface GuideState {
  quotes: number;
  publishedQuotes: number;
  acceptedQuotes: number;
  projects: number;
  brokenDownDeliverables: number;
  diaryEntries: number;
  invoices: number;
  /** Steps already seen, dismissed, or made irrelevant by doing the thing. */
  seen: GuideStep[];
}

/**
 * Whether the account has reached the point where a step is worth saying.
 *
 * Each condition is "you can do this now" rather than "you have not done this",
 * which is what stops the invoice hint appearing beside an empty tracker.
 */
export function isReady(step: GuideStep, state: GuideState): boolean {
  switch (step) {
    // Nothing at all yet. The only thing worth pointing at is the first quote.
    case "quote":
      return state.quotes === 0;

    // A quote exists and has never been sent. A draft nobody has seen is the
    // most common place for this to stall.
    case "publish":
      return state.quotes > 0 && state.publishedQuotes === 0;

    // Sent, and accepted, and still not being tracked. This is the expensive
    // gap: the work is happening and nothing is recording it.
    case "track":
      return state.acceptedQuotes > 0 && state.projects === 0;

    // Something is being tracked but nothing has been broken into steps.
    case "breakdown":
      return state.projects > 0 && state.brokenDownDeliverables === 0;

    // There is real work to report and the client has never been shown any.
    case "client":
      return state.brokenDownDeliverables > 0 && state.diaryEntries === 0;

    // Work has been shared and nothing has ever been invoiced.
    case "invoice":
      return state.diaryEntries > 0 && state.invoices === 0;
  }
}

/**
 * The single hint to show right now, or null.
 *
 * First unseen step whose moment has arrived. Returning one rather than a list
 * is the whole design: five true things at once is a tour, and a tour is what
 * this exists to avoid.
 */
export function nextHint(state: GuideState): GuideStep | null {
  for (const step of GUIDE_STEPS) {
    if (state.seen.includes(step)) continue;
    if (isReady(step, state)) return step;
  }
  return null;
}

/**
 * The hint for a particular screen, so a page only ever asks about itself.
 *
 * Without this the tracker would render the hint about making a first quote,
 * which is on a different page and cannot be pointed at from here.
 */
export const STEP_SCREEN: Record<GuideStep, string> = {
  // The wizard, where the Generate button is.
  quote: "/quote",
  // The finished quote, where Publish is.
  publish: "/quote/brief",
  // The quote list, where a landed quote offers Send to Track.
  track: "/quote",
  // One project, where all three of these buttons live.
  breakdown: "/track/project",
  client: "/track/project",
  invoice: "/track/project",
};

export function hintFor(screen: string, state: GuideState): GuideStep | null {
  const step = nextHint(state);
  if (!step) return null;
  return STEP_SCREEN[step] === screen ? step : null;
}

/**
 * Marking a step done.
 *
 * Idempotent, because a hint can be dismissed twice by a double click or by
 * two tabs, and a list with a step in it twice is a list that has to be
 * deduplicated everywhere it is read.
 */
export function markSeen(seen: GuideStep[], step: GuideStep): GuideStep[] {
  return seen.includes(step) ? seen : [...seen, step];
}

/** Whether anything is left to say, for hiding the machinery entirely. */
export function guideFinished(state: GuideState): boolean {
  return GUIDE_STEPS.every((step) => state.seen.includes(step));
}
