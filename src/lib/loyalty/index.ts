export function calculateEarnedPoints(totalPaise: number, earnPer100Rupees: number): number {
  return Math.floor(totalPaise / 10000) * earnPer100Rupees;
}

export function calculateRedemptionValue(points: number, unitPoints: number, unitValuePaise: number): number {
  if (points <= 0 || points % unitPoints !== 0) {
    throw new Error("Points must be a positive multiple of the redemption unit");
  }
  return (points / unitPoints) * unitValuePaise;
}
