import { randomInt } from "node:crypto";

const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export function generateTableCode(): string {
  return Array.from({ length: 10 }, () => alphabet[randomInt(alphabet.length)]).join("");
}
