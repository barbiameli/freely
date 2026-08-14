/**
 * What an email is for.
 *
 * A string union rather than the generated Prisma enum, because the generated
 * client in this workspace predates these columns, and because the one
 * distinction that matters here is a rule rather than a database detail:
 * everything up to and including the nudges is transactional, about work
 * somebody is doing and money they are owed, and MARKETING is the only kind
 * that has to check whether they want it.
 */
export type EmailKind =
  | "PASSWORD_RESET"
  | "QUOTE_ACCEPTED"
  | "TEAM_INVITE"
  | "NUDGE_TRACK_QUOTE"
  | "NUDGE_DUE_SOON"
  | "NUDGE_OVERDUE"
  | "MARKETING";

/** Whether this kind may be sent to somebody who has opted out. Only one
 * answer is ever false, and getting it wrong is a legal problem rather than a
 * bug. */
export function isTransactional(kind: EmailKind): boolean {
  return kind !== "MARKETING";
}
