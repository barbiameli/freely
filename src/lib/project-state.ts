/** Deliverable-progress math, kept pure and separate from server actions
 * (Next.js "use server" files may only export async functions) so it's
 * trivially unit-testable. */
export function deliverableProgress(deliverables: { done: boolean }[]): number {
  if (deliverables.length === 0) return 0;
  const done = deliverables.filter((d) => d.done).length;
  return done / deliverables.length;
}
