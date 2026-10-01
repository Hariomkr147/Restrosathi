import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const deriveKey = promisify(scrypt);

export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await deriveKey(secret, salt, 64) as Buffer;
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const [algorithm, saltText, hashText, extra] = stored.split("$");
  if (algorithm !== "scrypt" || !saltText || !hashText || extra !== undefined) return false;
  const salt = Buffer.from(saltText, "base64");
  const expected = Buffer.from(hashText, "base64");
  if (salt.length !== 16 || expected.length !== 64) return false;
  const actual = await deriveKey(secret, salt, 64) as Buffer;
  return timingSafeEqual(actual, expected);
}
