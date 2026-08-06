/**
 * A Freely account is either solo or part of a Team. Reads that list
 * "everything the studio is working on" (Track dashboard, Quote history)
 * should show every teammate's rows, not just the current user's — writes
 * still stamp `userId` with whoever performed the action.
 *
 * `teamId` is the signed-in user's own team id if they own one, or the team
 * they belong to as a member; null for solo accounts.
 */
export function teamScopeWhere(user: { id: string; teamId: string | null }) {
  if (!user.teamId) return { userId: user.id };
  return { user: { teamId: user.teamId } };
}
