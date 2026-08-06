import { NextResponse } from "next/server";
import crypto from "crypto";
import { getCurrentUser } from "@/lib/session";

/**
 * Kicks off the Figma OAuth flow. Requires a Figma OAuth app — create one at
 * https://www.figma.com/developers/apps, set its callback URL to
 * {your domain}/api/connect/figma/callback, and put the resulting
 * FIGMA_CLIENT_ID / FIGMA_CLIENT_SECRET in .env.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/signin", req.url));

  const clientId = process.env.FIGMA_CLIENT_ID;
  if (!clientId) {
    return new NextResponse(
      "Figma isn't configured yet. Add FIGMA_CLIENT_ID and FIGMA_CLIENT_SECRET to your .env file — see .env.example.",
      { status: 400 }
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/connect/figma/callback`;

  // The state token ties the callback back to this signed-in user and guards
  // against CSRF; it's short-lived and single-use via the cookie below.
  const state = crypto.randomBytes(16).toString("hex");

  const authorizeUrl = new URL("https://www.figma.com/oauth");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  // "file_read" was Figma's old catch-all scope and is now deprecated —
  // file_content:read is the current granular equivalent for reading a
  // file's layers/content, which is all lib/figma.ts's getFigmaFileSummary
  // needs. Must match a scope selected for this app in Figma's dashboard
  // under "Review scopes," or the authorize request will 400.
  authorizeUrl.searchParams.set("scope", "file_content:read");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("response_type", "code");

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set("figma_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return res;
}
