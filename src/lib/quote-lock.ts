/**
 * When a quote stops being a draft.
 *
 * A quote a client has signed is a document they agreed to, at a URL they can
 * reopen. Freely let it be rewritten underneath them: refine it, remove a
 * section, edit the price, and the page the client bookmarked quietly said
 * something else. Layout pinning was built so a published quote never changes
 * shape; this is the same argument about its contents, and it matters more.
 *
 * Two things lock it, and they are the two ways a job becomes real. A client
 * signing is the obvious one. Sending it to Track is the other: at that point
 * the deliverables, the price and the schedule are what the work is being run
 * against, and editing the quote after that puts the tracker and the document
 * out of step with each other.
 *
 * Locking is not the same as freezing the record. Everything a freelancer does
 * *around* an agreed quote still works: marking work done, invoicing, writing
 * a follow-on quote. What stops is changing what was agreed.
 */

export type LockReason = "signed" | "tracked";

export interface Lockable {
  /** When the client signed it, if they did. */
  acceptedAt?: Date | string | null;
  /** "DRAFT" or "TRACKED". */
  status?: string | null;
}

/** Why this quote is locked, or nothing. */
export function lockReason(quote: Lockable): LockReason | null {
  // Signing wins when both are true, because it is the stronger fact: a
  // freelancer can untrack a project, and cannot unsign a client.
  if (quote.acceptedAt) return "signed";
  if (quote.status === "TRACKED") return "tracked";
  return null;
}

export function isLocked(quote: Lockable): boolean {
  return lockReason(quote) !== null;
}

/**
 * What the app should say when somebody tries anyway.
 *
 * Named per reason rather than one message, because the two are different
 * situations with different ways out: an untracked project is a decision the
 * freelancer can reverse, and a signature is not.
 */
export function lockMessage(reason: LockReason): string {
  return reason === "signed"
    ? "Your client has signed this quote, so it cannot be changed. Write a follow-on quote for anything extra."
    : "This quote is being tracked as a project, so it cannot be changed. Write a follow-on quote for anything extra.";
}
