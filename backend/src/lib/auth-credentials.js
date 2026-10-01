import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export function createAuthCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashAuthCode(code) {
  const pepper = process.env.AUTH_CREDENTIAL_PEPPER || process.env.JWT_SECRET;
  if (!pepper || pepper.length < 32) {
    throw new Error("Set AUTH_CREDENTIAL_PEPPER or a JWT_SECRET of at least 32 characters.");
  }
  const credentialKey = createHmac("sha256", pepper).update("glamora-auth-credential-hmac-v1").digest();
  return createHmac("sha256", credentialKey).update(code).digest("hex");
}

export function authCodeMatches(code, expectedHash) {
  const suppliedHash = Buffer.from(hashAuthCode(code), "hex");
  const storedHash = Buffer.from(expectedHash, "hex");
  return suppliedHash.length === storedHash.length && timingSafeEqual(suppliedHash, storedHash);
}