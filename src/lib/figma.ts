import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/crypto";

/** Returns the signed-in user's stored Figma access token, or null if they
 * haven't connected Figma in Memory → Connectors. Doesn't yet handle token
 * refresh — Figma access tokens are valid for 90 days, so re-connecting
 * periodically is fine for v1; wire up refreshTokenCipher here when that
 * becomes annoying. */
export async function getFigmaAccessToken(userId: string): Promise<string | null> {
  const connection = await prisma.connection.findUnique({
    where: { userId_provider: { userId, provider: "FIGMA" } },
  });
  if (!connection) return null;
  if (connection.expiresAt && connection.expiresAt < new Date()) return null;
  return decryptToken(connection.accessTokenCipher);
}

export interface FigmaFileSummary {
  name: string;
  lastModified: string;
  thumbnailUrl: string;
}

/** Fetches basic metadata for a Figma file — a starting point for pulling a
 * design's name/structure into a quote's source material. Extend with
 * `GET /v1/files/:key/nodes` for specific frames as that need shows up. */
export async function getFigmaFileSummary(
  fileKey: string,
  accessToken: string
): Promise<FigmaFileSummary> {
  const res = await fetch(`https://api.figma.com/v1/files/${fileKey}?depth=1`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Figma API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return {
    name: data.name,
    lastModified: data.lastModified,
    thumbnailUrl: data.thumbnailUrl,
  };
}
