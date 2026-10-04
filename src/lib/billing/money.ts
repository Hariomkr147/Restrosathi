export function rh(a: number, b: number): number {
  if (a < 0 || b <= 0 || !Number.isInteger(a) || !Number.isInteger(b)) {
    throw new Error("Invalid input for round-half-up");
  }
  return Math.floor((2 * a + b) / (2 * b));
}
