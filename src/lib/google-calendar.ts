import { prisma } from "@/lib/prisma";
import { encryptToken, decryptToken } from "@/lib/crypto";

/**
 * Writing deliverable dates into somebody's own Google Calendar.
 *
 * The alternative was a subscribable feed, which needs no permission and no
 * tokens. This is the other choice, and it is worth being clear about what it
 * costs: real events in their calendar, editable and movable there, at the price
 * of holding a credential that can write to it.
 *
 * So the whole file is written around that credential.
 *
 * The scope is calendar.events and nothing else. Not calendar, which includes
 * creating and deleting whole calendars, and not readonly on top: the narrowest
 * scope that does the job is the one that limits the damage if the token leaks.
 *
 * Tokens are encrypted at rest with the same key as the other connections, and
 * never returned to a client or logged. An access token lasts an hour and is
 * refreshed here; the refresh token is the one that matters and is the reason
 * disconnecting revokes at Google rather than only deleting our row.
 *
 * Every call is best effort. A calendar being unreachable must not stop a date
 * being changed in Freely: the tracker is the record, the calendar is a copy.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

/** Write events, and nothing else. Not calendar, which can delete calendars. */
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

interface StoredConnection {
  id: string;
  accessTokenCipher: string;
  refreshTokenCipher: string | null;
  expiresAt: Date | null;
}

/**
 * A usable access token, refreshing it first if it is close to expiry.
 *
 * Refreshes a minute early rather than on expiry, because a token that expires
 * between the check and the request fails in a way that looks like a bug.
 * Returns null rather than throwing when there is no connection, since "not
 * connected" is the normal case for most people.
 */
async function accessTokenFor(userId: string): Promise<string | null> {
  const connection = (await prisma.connection.findFirst({
    where: { userId, provider: "GOOGLE_CALENDAR" as never },
  })) as unknown as StoredConnection | null;
  if (!connection) return null;

  const soon = new Date(Date.now() + 60_000);
  if (connection.expiresAt && connection.expiresAt > soon) {
    return decryptToken(connection.accessTokenCipher);
  }
  if (!connection.refreshTokenCipher) return null;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: decryptToken(connection.refreshTokenCipher),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    // Usually means access was revoked from Google's own settings page, which
    // is a thing people do and is not an error worth shouting about. The row
    // stays so the Memory page can still offer to reconnect.
    console.warn("[calendar] refresh failed", res.status);
    return null;
  }

  const tokens = (await res.json()) as { access_token: string; expires_in: number };
  await prisma.connection.update({
    where: { id: connection.id },
    data: {
      accessTokenCipher: encryptToken(tokens.access_token),
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });
  return tokens.access_token;
}

export interface CalendarEvent {
  /** What the event is called. The deliverable, and the project after it. */
  title: string;
  /** All day, on this date. Nobody knows what hour a deliverable is due, and
   * inventing 9am puts a false precision in somebody's morning. */
  date: Date;
  /** A line of context and a link back. */
  description: string;
}

/** yyyy-mm-dd in UTC, which is what an all-day event wants. */
function dayString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The next day, since Google treats an all-day end as exclusive. */
function nextDayString(date: Date): string {
  return dayString(new Date(date.getTime() + 24 * 3600_000));
}

function body(event: CalendarEvent) {
  return {
    summary: event.title,
    description: event.description,
    start: { date: dayString(event.date) },
    end: { date: nextDayString(event.date) },
    // Freely is not the source of truth for reminders. Whatever they have set
    // as their own default is a decision they already made.
    reminders: { useDefault: true },
  };
}

/**
 * Creates the event, or updates the one already there.
 *
 * Returns the event id, so the deliverable can remember it and a moved date
 * updates rather than leaving a stale event beside a new one. Returns null on
 * any failure, and the caller carries on: a calendar that is down is not a
 * reason to refuse a date change.
 */
export async function upsertEvent(
  userId: string,
  event: CalendarEvent,
  existingEventId?: string | null
): Promise<string | null> {
  const token = await accessTokenFor(userId);
  if (!token) return null;

  try {
    const url = existingEventId ? `${EVENTS_URL}/${existingEventId}` : EVENTS_URL;
    const res = await fetch(url, {
      method: existingEventId ? "PATCH" : "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body(event)),
    });

    // The event was deleted in Google. Making a new one is right: they moved
    // the date in Freely, so they want it in their calendar.
    if (res.status === 404 && existingEventId) return upsertEvent(userId, event, null);
    if (!res.ok) {
      console.warn("[calendar] upsert failed", res.status);
      return null;
    }
    const created = (await res.json()) as { id: string };
    return created.id;
  } catch (err) {
    console.warn("[calendar] upsert threw", err);
    return null;
  }
}

/** Removes an event, quietly. A 404 is success: it is already not there. */
export async function deleteEvent(userId: string, eventId: string): Promise<void> {
  const token = await accessTokenFor(userId);
  if (!token) return;
  try {
    await fetch(`${EVENTS_URL}/${eventId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    console.warn("[calendar] delete threw", err);
  }
}

/**
 * Disconnecting.
 *
 * Revokes at Google before deleting the row, so the grant actually ends rather
 * than us forgetting a credential that still works. If the revoke fails the row
 * goes anyway, because leaving somebody unable to disconnect is worse.
 */
export async function disconnectCalendar(userId: string): Promise<void> {
  const connection = (await prisma.connection.findFirst({
    where: { userId, provider: "GOOGLE_CALENDAR" as never },
  })) as unknown as StoredConnection | null;
  if (!connection) return;

  try {
    const token = connection.refreshTokenCipher
      ? decryptToken(connection.refreshTokenCipher)
      : decryptToken(connection.accessTokenCipher);
    await fetch(REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
  } catch (err) {
    console.warn("[calendar] revoke failed, deleting anyway", err);
  }

  await prisma.connection.delete({ where: { id: connection.id } });
}

/** Whether this person has a calendar connected. */
export async function hasCalendar(userId: string): Promise<boolean> {
  const count = await prisma.connection.count({
    where: { userId, provider: "GOOGLE_CALENDAR" as never },
  });
  return count > 0;
}
