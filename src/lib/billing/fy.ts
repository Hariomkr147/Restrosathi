export function financialYear(date: Date): string {
  // IST offset is UTC+5:30
  // Instead of complex parsing, we can construct the IST date
  // by adding 5 hours 30 mins to the UTC time
  const istDate = new Date(date.getTime() + (5 * 60 + 30) * 60 * 1000);
  
  const year = istDate.getUTCFullYear();
  const month = istDate.getUTCMonth(); // 0-indexed, so Jan = 0, Feb = 1, Mar = 2, Apr = 3
  
  // FY starts April 1st.
  let startYear = year;
  if (month < 3) {
    startYear = year - 1;
  }
  
  const endYear = (startYear + 1).toString().slice(-2);
  return `${startYear}-${endYear}`;
}

export function formatInvoiceNumber(fy: string, seq: number): string {
  const paddedSeq = seq.toString().padStart(4, "0");
  return `${fy}/${paddedSeq}`;
}
