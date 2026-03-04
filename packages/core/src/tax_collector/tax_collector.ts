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
      totalGrossProfit: initialState?.totalGrossProfit ?? 0,
      annualExemptRemaining: initialState?.annualExemptRemaining ?? config.annualExemptAmount,
      useAnnualExempt: initialState?.useAnnualExempt ?? config.useAnnualExempt,
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
   * Behaviour depends on `useAnnualExempt`:
   * - **true** (default): All profits are recorded. Tax is only reserved
   *   once cumulative gross profits in the tax year exceed the annual
   *   exempt amount (£3,000). For the trade that crosses the threshold,
   *   only the portion above the threshold is taxed.
   * - **false**: Every profitable trade is taxed immediately at the
   *   configured reserve rate; the annual exempt amount is ignored.
   *
   * @param grossProfit - Gross profit from the trade (must be positive)
   * @param executionId - Trade execution ID for audit trail
   * @returns The reserve entry, or null if no tax is owed
   */
  reserveFromProfit(
    grossProfit: number,
    executionId: string
  ): TaxReserveEntry | null {
    if (grossProfit <= 0) return null;

    // Check if we've moved to a new tax year
    this.checkTaxYearRollover();

    // Always track cumulative gross profit
    this.state.totalGrossProfit += grossProfit;
    this.state.totalTrades += 1;
    this.state.updatedAt = now();

    let taxableGain: number;

    if (this.state.useAnnualExempt) {
      // ---- Cumulative threshold mode ----
      // Only start reserving tax once total gross profit exceeds the exempt amount.
      const previousGross = this.state.totalGrossProfit - grossProfit;

      if (this.state.totalGrossProfit <= this.config.annualExemptAmount) {
        // Still within annual exempt — no tax owed
        this.state.annualExemptRemaining =
          this.config.annualExemptAmount - this.state.totalGrossProfit;
        return null;
      }

      if (previousGross >= this.config.annualExemptAmount) {
        // Already past the threshold — entire profit is taxable
        taxableGain = grossProfit;
      } else {
        // This trade crosses the threshold — only tax the overshoot
        taxableGain = this.state.totalGrossProfit - this.config.annualExemptAmount;
      }

      this.state.annualExemptRemaining = 0;
    } else {
      // ---- No exempt mode — tax every profit immediately ----
      taxableGain = grossProfit;
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

    return entry;
  }

  /**
   * Get a report of estimated tax liability for the current tax year.
   */
  getReserveReport(): {
    taxYear: string;
    totalReserved: number;
    totalTrades: number;
    totalGrossProfit: number;
    annualExemptRemaining: number;
    annualExemptUsed: number;
    useAnnualExempt: boolean;
    effectiveRate: number;
  } {
    const annualExemptUsed = this.state.useAnnualExempt
      ? this.config.annualExemptAmount - this.state.annualExemptRemaining
      : 0;

    return {
      taxYear: this.state.taxYear,
      totalReserved: this.state.totalReserved,
      totalTrades: this.state.totalTrades,
      totalGrossProfit: this.state.totalGrossProfit,
      annualExemptRemaining: this.state.annualExemptRemaining,
      annualExemptUsed,
      useAnnualExempt: this.state.useAnnualExempt,
      effectiveRate: this.config.reserveRate,
    };
  }

  private checkTaxYearRollover(): void {
    const currentTaxYear = getUKTaxYear(new Date());
    if (currentTaxYear !== this.state.taxYear) {
      // New tax year — reset exempt amount and cumulative profits, keep accumulated reserve
      this.state.taxYear = currentTaxYear;
      this.state.annualExemptRemaining = this.config.annualExemptAmount;
      this.state.totalGrossProfit = 0;
    }
  }
}
