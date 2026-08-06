import crypto from "crypto";

/**
 * Symmetric encryption for OAuth tokens at rest (Connection.accessTokenCipher /
 * refreshTokenCipher). Uses AES-256-GCM with a key derived from
 * FREELY_ENCRYPTION_KEY — generate one with `openssl rand -base64 32`, same
 * as NEXTAUTH_SECRET. Never log or return decrypted tokens to the client.
 */
function getKey(): Buffer {
  const secret = process.env.FREELY_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "FREELY_ENCRYPTION_KEY is not set. Add it to your .env file — see .env.example."
    );
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(
    "."
  );
}

export function decryptToken(cipherText: string): string {
  const key = getKey();
  const [ivB64, tagB64, dataB64] = cipherText.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Malformed encrypted token.");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
