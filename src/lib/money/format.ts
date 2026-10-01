const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
});

export function formatINR(paise: number): string {
  if (!Number.isInteger(paise)) {
    throw new RangeError("Money must be integer paise");
  }
  return inr.format(paise / 100);
}
