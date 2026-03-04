// ============================================================================
// Tax Collector — UK CGT reserve for crypto trades
// ============================================================================
// Only applies to crypto spot trades. FX spread bet profits are tax-free.
// Reserves ~24% of each profitable crypto trade as a CGT buffer.
// Year-end reconciliation with actual HMRC-compliant calculation required.

import type {
  TaxReserveEntry,
  TaxReserveState,
  TaxCollectorConfig,
} from "@trading-pod/shared";
import { generateId, now, DEFAULT_TAX_CONFIG, getUKTaxYear } from "@trading-pod/shared";

/**
 * Tax Collector.
 * Siphons an estimated CGT reserve from each profitable crypto trade.
 * This is a CASH-FLOW BUFFER, not a final tax calculation.
 *
 * Important: Actual CGT liability depends on HMRC matching rules
 * (same-day, 30-day, section 104 pool) and must be calculated at year-end.
 */
export class TaxCollector {
  private state: TaxReserveState;
  private config: TaxCollectorConfig;

  constructor(
    config: TaxCollectorConfig = DEFAULT_TAX_CONFIG,
    initialState?: Partial<TaxReserveState>
  ) {
    this.config = config;

    const taxYear = getUKTaxYear(new Date());
    this.state = {
      taxYear: initialState?.taxYear ?? taxYear,
      totalReserved: initialState?.totalReserved ?? 0,
      totalTrades: initialState?.totalTrades ?? 0,
      annualExemptRemaining: initialState?.annualExemptRemaining ?? config.annualExemptAmount,
      updatedAt: now(),
    };
  }

  /** Get current state (read-only copy) */
  getState(): TaxReserveState {
    return { ...this.state };
  }

  /** Load state from persistence */
  loadState(state: TaxReserveState): void {
    this.state = { ...state };
  }

  /**
   * Process a profitable crypto trade and calculate the tax reserve.
   *
   * @param grossProfit - Gross profit from the trade (must be positive)
   * @param executionId - Trade execution ID for audit trail
   * @returns The reserve entry, or null if no tax is owed (within annual exempt amount)
   */
  reserveFromProfit(
    grossProfit: number,
    executionId: string
  ): TaxReserveEntry | null {
    if (grossProfit <= 0) return null;

    // Check if we've moved to a new tax year
    this.checkTaxYearRollover();

    // Apply annual exempt amount first
    let taxableGain = grossProfit;

    if (this.state.annualExemptRemaining > 0) {
      const exemptUsed = Math.min(this.state.annualExemptRemaining, taxableGain);
      this.state.annualExemptRemaining -= exemptUsed;
      taxableGain -= exemptUsed;
    }

    if (taxableGain <= 0) {
      // Entirely covered by annual exempt amount
      this.state.totalTrades += 1;
      this.state.updatedAt = now();
      return null;
    }

    // Reserve the configured rate on the taxable portion
    const reservedAmount = taxableGain * this.config.reserveRate;

    const entry: TaxReserveEntry = {
      entryId: generateId(),
      executionId,
      grossProfit,
      reserveRate: this.config.reserveRate,
      reservedAmount,
      taxYear: this.state.taxYear,
      createdAt: now(),
    };

    this.state.totalReserved += reservedAmount;
    this.state.totalTrades += 1;
    this.state.updatedAt = now();

    return entry;
  }

  /**
   * Get a report of estimated tax liability for the current tax year.
   */
  getReserveReport(): {
    taxYear: string;
    totalReserved: number;
    totalTrades: number;
    annualExemptRemaining: number;
    annualExemptUsed: number;
    effectiveRate: number;
  } {
    const annualExemptUsed =
      this.config.annualExemptAmount - this.state.annualExemptRemaining;

    return {
      taxYear: this.state.taxYear,
      totalReserved: this.state.totalReserved,
      totalTrades: this.state.totalTrades,
      annualExemptRemaining: this.state.annualExemptRemaining,
      annualExemptUsed,
      effectiveRate: this.config.reserveRate,
    };
  }

  private checkTaxYearRollover(): void {
    const currentTaxYear = getUKTaxYear(new Date());
    if (currentTaxYear !== this.state.taxYear) {
      // New tax year — reset exempt amount, keep accumulated reserve
      this.state.taxYear = currentTaxYear;
      this.state.annualExemptRemaining = this.config.annualExemptAmount;
    }
  }
}
