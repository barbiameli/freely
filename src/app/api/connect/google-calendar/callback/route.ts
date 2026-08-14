import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { encryptToken } from "@/lib/crypto";

interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

/**
 * Coming back from Google with the grant.
 *
 * The state cookie is checked before anything else. Without it this endpoint
 * would accept a code from anywhere, which is how an attacker attaches their
 * own calendar to somebody else's account.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/signin", req.url));

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("gcal_oauth_state="))
    ?.split("=")[1];

  // Somebody pressing Cancel at Google lands here too, and that is not an
  // error worth a stack trace: send them back where they came from.
  if (url.searchParams.get("error")) {
    return NextResponse.redirect(new URL("/memory?tab=sources", req.url));
  }
  if (!code || !state || state !== cookieState) {
    return new NextResponse("That took too long or came from somewhere unexpected. Try again from Memory.", {
      status: 400,
    });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return new NextResponse("Google is not configured.", { status: 400 });
  }

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${baseUrl}/api/connect/google-calendar/callback`,
    }),
  });

  if (!tokenRes.ok) {
    return new NextResponse("Google would not complete that. Try again from Memory.", {
      status: 400,
    });
  }
  const tokens = (await tokenRes.json()) as GoogleTokens;

  // Without a refresh token this connection dies in an hour. Better to refuse
  // it now with an explanation than to look connected and quietly stop.
  if (!tokens.refresh_token) {
    return new NextResponse(
      "Google did not return a refresh token. Remove Freely from your Google account permissions and connect again.",
      { status: 400 }
    );
  }

  const data = {
    accessTokenCipher: encryptToken(tokens.access_token),
    refreshTokenCipher: encryptToken(tokens.refresh_token),
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    accountLabel: user.email ?? null,
  };

  await prisma.connection.upsert({
    where: { userId_provider: { userId: user.id, provider: "GOOGLE_CALENDAR" as never } },
    update: data,
    create: { userId: user.id, provider: "GOOGLE_CALENDAR" as never, ...data },
  });

  return NextResponse.redirect(new URL("/memory?tab=sources", req.url));
}
