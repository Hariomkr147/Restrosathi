export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) {
    if (!/^[6-9]/.test(digits)) return null;
    return `+91${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    const national = digits.slice(1);
    if (!/^[6-9]/.test(national)) return null;
    return `+91${national}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    const national = digits.slice(2);
    if (!/^[6-9]/.test(national)) return null;
    return `+91${national}`;
  }
  return null;
}
