// ============================================================================
// Context Providers — Market State Classifier
// ============================================================================

import type { MarketStateOutput, MarketRegime } from "@trading-pod/shared";
import { now } from "@trading-pod/shared";

/**
 * Market State context provider.
 * Classifies the current market regime (trending, ranging, volatile).
 *
 * TODO: Implement real regime detection using ATR, ADX, and volatility metrics
 */
export class MarketStateClassifier {
  /**
   * Classify market regime from price data.
   * Stub implementation — defaults to "ranging".
   */
  classify(
    instrument: string,
    priceHistory: number[]
  ): MarketStateOutput {
    // TODO: Implement regime classification
    // - ADX > 25 → trending
    // - ATR expanding rapidly → volatile
    // - Otherwise → ranging

    let regime: MarketRegime = "ranging";
    let confidence = 0.5;
    let atrPercent = 0;

    if (priceHistory.length >= 14) {
      // Simple ATR-based stub
      const ranges: number[] = [];
      for (let i = 0; i < Math.min(14, priceHistory.length - 1); i++) {
        ranges.push(Math.abs(priceHistory[i] - priceHistory[i + 1]));
      }
      const atr = ranges.reduce((s, r) => s + r, 0) / ranges.length;
      const avgPrice = priceHistory.slice(0, 14).reduce((s, p) => s + p, 0) / 14;
      atrPercent = avgPrice > 0 ? (atr / avgPrice) * 100 : 0;

      if (atrPercent > 3) {
        regime = "volatile";
        confidence = 0.7;
      } else if (atrPercent > 1) {
        regime = "trending";
        confidence = 0.6;
      } else {
        regime = "ranging";
        confidence = 0.6;
      }
    }

    return {
      regime,
      confidence,
      atrPercent,
      instrument,
      timestamp: now(),
    };
  }
}

export function createMarketStateClassifier(): MarketStateClassifier {
  return new MarketStateClassifier();
}
