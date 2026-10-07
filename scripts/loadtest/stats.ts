/**
 * Calculates a percentile from an array of numbers using linear interpolation.
 * @param data Array of numbers
 * @param p Percentile (0 to 100)
 */
export function percentile(data: number[], p: number): number {
  if (data.length === 0) return 0;
  if (data.length === 1) return data[0];
  
  const sorted = [...data].sort((a, b) => a - b);
  const index = (sorted.length - 1) * (p / 100);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  
  if (lower === upper) return sorted[lower];
  
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}
