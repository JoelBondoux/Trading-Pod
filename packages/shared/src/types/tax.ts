// ============================================================================
// Tax Collector Types — UK CGT reserve management (crypto only)
// ============================================================================

/** Tax reserve entry for a single profitable crypto trade */
export interface TaxReserveEntry {
  /** Unique entry identifier */
  entryId: string;

  /** Associated trade execution ID */
  executionId: string;

  /** Gross profit from the trade */
  grossProfit: number;

  /** Reserve rate applied (e.g., 0.24 for 24%) */
  reserveRate: number;

  /** Amount reserved for tax */
  reservedAmount: number;

  /** UK tax year (e.g., "2025/26") */
  taxYear: string;

  /** ISO 8601 timestamp */
  createdAt: string;
}

/** Aggregate tax reserve state for a tax year */
export interface TaxReserveState {
  /** UK tax year (e.g., "2025/26") */
  taxYear: string;

  /** Total amount reserved for CGT */
  totalReserved: number;

  /** Number of profitable trades contributing */
  totalTrades: number;

  /** Annual exempt amount remaining (starts at £3,000) */
  annualExemptRemaining: number;

  /** ISO 8601 timestamp of last update */
  updatedAt: string;
}

/** Tax Collector configuration */
export interface TaxCollectorConfig {
  /** CGT reserve rate for crypto gains (default 0.24 = 24%) */
  reserveRate: number;

  /** Annual exempt amount in GBP (£3,000 for 2025/26) */
  annualExemptAmount: number;
}

/** Default Tax Collector configuration */
export const DEFAULT_TAX_CONFIG: TaxCollectorConfig = {
  reserveRate: 0.24,
  annualExemptAmount: 3000,
};

/**
 * Get the UK tax year string for a given date.
 * UK tax year runs 6 April to 5 April.
 * e.g., 1 Jan 2026 → "2025/26", 10 April 2026 → "2026/27"
 */
export function getUKTaxYear(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  const day = date.getDate();

  // Before 6 April → previous tax year
  if (month < 3 || (month === 3 && day < 6)) {
    return `${year - 1}/${String(year).slice(2)}`;
  }
  return `${year}/${String(year + 1).slice(2)}`;
}
