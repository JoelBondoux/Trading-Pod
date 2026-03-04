// ============================================================================
// Currency Converter — USD→GBP for UK tax calculations
// ============================================================================
// Crypto prices from Kraken are in USD. UK CGT must be computed in GBP.
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
   * Uses the Kraken public ticker for GBP/USD as it's already a dependency.
   * Falls back to the configured fallback rate on error.
   */
  async refresh(): Promise<void> {
    try {
      // Kraken public API — no auth needed
      // GBPUSD ticker gives us USD per GBP, we need the inverse
      const res = await fetch(
        "https://api.kraken.com/0/public/Ticker?pair=GBPUSD"
      );

      if (!res.ok) {
        console.warn(`Currency rate fetch failed: ${res.status}`);
        return;
      }

      const data = (await res.json()) as {
        error: string[];
        result?: Record<string, { c: [string, string] }>;
      };

      if (data.error?.length > 0) {
        console.warn(`Kraken API error: ${data.error.join(", ")}`);
        return;
      }

      // Extract last trade price for GBPUSD
      const pair = data.result ? Object.values(data.result)[0] : undefined;
      if (!pair?.c?.[0]) {
        console.warn("No rate data in Kraken response");
        return;
      }

      const gbpPerUsd = 1 / parseFloat(pair.c[0]);

      this.rate = {
        from: "USD",
        to: "GBP",
        rate: gbpPerUsd,
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
