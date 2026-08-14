import { NextResponse } from "next/server";
import crypto from "crypto";
import { getCurrentUser } from "@/lib/session";
import { CALENDAR_SCOPE } from "@/lib/google-calendar";

/**
 * Asking for calendar access.
 *
 * Deliberately its own flow rather than folded into signing in with Google.
 * Reading somebody's identity and writing to their calendar are different
 * permissions, and bundling them means asking for the bigger one at the moment
 * somebody just wants to get into the app. "Let me put your deadlines in your
 * calendar" deserves its own yes.
 *
 * Reuses the Google OAuth app that sign-in already uses, so it needs no new
 * credentials. Its redirect URI does have to be added in the Google Cloud
 * console: {your domain}/api/connect/google-calendar/callback.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/signin", req.url));

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return new NextResponse(
      "Google is not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, see .env.example.",
      { status: 400 }
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const state = crypto.randomBytes(16).toString("hex");

  const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", `${baseUrl}/api/connect/google-calendar/callback`);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", CALENDAR_SCOPE);
  authorize.searchParams.set("state", state);
  // offline plus consent is what produces a refresh token. Without both, the
  // access token expires in an hour and the connection silently stops working,
  // which is the most common way this integration is got wrong.
  authorize.searchParams.set("access_type", "offline");
  authorize.searchParams.set("prompt", "consent");

  const res = NextResponse.redirect(authorize);
  res.cookies.set("gcal_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return res;
}
