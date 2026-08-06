import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { encryptToken } from "@/lib/crypto";

interface FigmaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface FigmaUserResponse {
  email: string;
  handle: string;
}

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
    .find((c) => c.startsWith("figma_oauth_state="))
    ?.split("=")[1];

  if (!code || !state || state !== cookieState) {
    return new NextResponse("Figma sign-in failed or expired — try connecting again from Memory.", {
      status: 400,
    });
  }

  const clientId = process.env.FIGMA_CLIENT_ID;
  const clientSecret = process.env.FIGMA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return new NextResponse("Figma isn't configured (missing FIGMA_CLIENT_ID/SECRET).", { status: 400 });
  }

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/connect/figma/callback`;

  // Figma's token endpoint lives on api.figma.com, not www.figma.com — the
  // authorize *page* is on www, but the token exchange is a different host.
  const tokenRes = await fetch("https://api.figma.com/v1/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      redirect_uri: redirectUri,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return new NextResponse(`Figma token exchange failed: ${await tokenRes.text()}`, { status: 400 });
  }
  const tokens = (await tokenRes.json()) as FigmaTokenResponse;

  let accountLabel: string | null = null;
  try {
    const meRes = await fetch("https://api.figma.com/v1/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (meRes.ok) {
      const me = (await meRes.json()) as FigmaUserResponse;
      accountLabel = me.email || me.handle || null;
    }
  } catch {
    // Non-fatal — the connection still works without a display label.
  }

  await prisma.connection.upsert({
    where: { userId_provider: { userId: user.id, provider: "FIGMA" } },
    create: {
      userId: user.id,
      provider: "FIGMA",
      accountLabel,
      accessTokenCipher: encryptToken(tokens.access_token),
      refreshTokenCipher: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
    update: {
      accountLabel,
      accessTokenCipher: encryptToken(tokens.access_token),
      refreshTokenCipher: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });

  const res = NextResponse.redirect(new URL("/memory", req.url));
  res.cookies.delete("figma_oauth_state");
  return res;
}
