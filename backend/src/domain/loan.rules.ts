export const LOAN_INTEREST_RATE_BANDS = [
  { maxMonths: 12, annualRate: 10.5 },
  { maxMonths: 24, annualRate: 11 },
  { maxMonths: 36, annualRate: 11.5 },
  { maxMonths: 48, annualRate: 12 },
  { maxMonths: 60, annualRate: 12.5 },
] as const;

export function configuredLoanRate(durationMonths: number) {
  const band = LOAN_INTEREST_RATE_BANDS.find((candidate) => durationMonths <= candidate.maxMonths);
  if (!band || durationMonths < 1) throw new Error("UNSUPPORTED_LOAN_DURATION");
  return band.annualRate;
}

export function estimatedMonthlyEmi(principal: number, annualRate: number, months: number) {
  const monthlyRate = annualRate / 1200;
  if (monthlyRate === 0) return principal / months;
  const factor = Math.pow(1 + monthlyRate, months);
  return principal * monthlyRate * factor / (factor - 1);
}
