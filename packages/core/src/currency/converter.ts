// ============================================================================
// Currency Converter — USD→GBP for UK tax calculations
// ============================================================================
// Some broker prices may be in USD. UK CGT must be computed in GBP.
// This module provides exchange rate fetching and conversion utilities.
// ============================================================================

export interface ExchangeRate {
  /** Source currency */
  from: string;
  /** Target currency */
  to: string;
  /** Conversion rate (multiply source amount by this) */
  rate: number;
  /** ISO 8601 timestamp of when rate was fetched */
  fetchedAt: string;
}

export interface CurrencyConverterConfig {
  /** How often to refresh the rate, in seconds (default: 300 = 5 minutes) */
  refreshIntervalSeconds: number;
  /** Fallback rate if API is unavailable (default: 0.79) */
  fallbackRate: number;
}

export const DEFAULT_CONVERTER_CONFIG: CurrencyConverterConfig = {
  refreshIntervalSeconds: 300,
  fallbackRate: 0.79, // Approximate USD→GBP as of 2025
};

/**
 * Currency Converter with cached exchange rate.
 *
 * Usage:
 * ```ts
 * const converter = new CurrencyConverter();
 * await converter.refresh(); // optional — fetch latest rate
 * const gbpAmount = converter.usdToGbp(150.00);
 * ```
 */
export class CurrencyConverter {
  private rate: ExchangeRate;
  private config: CurrencyConverterConfig;

  constructor(config: CurrencyConverterConfig = DEFAULT_CONVERTER_CONFIG) {
    this.config = config;
    this.rate = {
      from: "USD",
      to: "GBP",
      rate: config.fallbackRate,
      fetchedAt: new Date().toISOString(),
    };
  }

  /** Convert USD amount to GBP using cached rate */
  usdToGbp(usdAmount: number): number {
    return usdAmount * this.rate.rate;
  }

  /** Get the current cached rate */
  getRate(): ExchangeRate {
    return { ...this.rate };
  }

  /** Check if rate is stale (older than refresh interval) */
  isStale(): boolean {
    const age = (Date.now() - new Date(this.rate.fetchedAt).getTime()) / 1000;
    return age > this.config.refreshIntervalSeconds;
  }

  /**
   * Refresh the exchange rate from a public API.
   * Uses the open.er-api.com free endpoint (no auth required).
   * Falls back to the configured fallback rate on error.
   */
  async refresh(): Promise<void> {
    try {
      // Free exchange rate API — no auth needed
      const res = await fetch(
        "https://open.er-api.com/v6/latest/USD"
      );

      if (!res.ok) {
        console.warn(`Currency rate fetch failed: ${res.status}`);
        return;
      }

      const data = (await res.json()) as {
        result?: string;
        rates?: Record<string, number>;
      };

      if (data.result !== "success" || !data.rates?.GBP) {
        console.warn("No GBP rate in exchange rate response");
        return;
      }

      this.rate = {
        from: "USD",
        to: "GBP",
        rate: data.rates.GBP,
        fetchedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.warn("Currency rate refresh failed, using cached/fallback rate", err);
    }
  }

  /** Manually set rate (for testing or manual override) */
  setRate(rate: number): void {
    this.rate = {
      from: "USD",
      to: "GBP",
      rate,
      fetchedAt: new Date().toISOString(),
    };
  }
}
