// ============================================================================
// Market State Classifier Tests — ATR-based regime detection
// ============================================================================

import { describe, it, expect } from "vitest";
import { MarketStateClassifier, createMarketStateClassifier } from "../src/context_providers/market_state.js";

describe("MarketStateClassifier.classify", () => {
  const classifier = new MarketStateClassifier();

  it("defaults to 'ranging' with insufficient data (< 14 prices)", () => {
    const result = classifier.classify("GBP/USD", [1.30, 1.31, 1.29]);
    expect(result.regime).toBe("ranging");
    expect(result.confidence).toBe(0.5);
    expect(result.atrPercent).toBe(0);
    expect(result.instrument).toBe("GBP/USD");
    expect(result.timestamp).toBeTruthy();
  });

  it("classifies low ATR as 'ranging'", () => {
    // 15 prices with tiny changes: ATR% < 1%
    const prices = Array.from({ length: 15 }, (_, i) =>
      1.30 + (i % 2 === 0 ? 0.001 : -0.001)
    );
    const result = classifier.classify("GBP/USD", prices);
    expect(result.regime).toBe("ranging");
    expect(result.atrPercent).toBeLessThan(1);
  });

  it("classifies medium ATR as 'trending'", () => {
    // 15 prices with moderate changes: 1% < ATR% < 3%
    const prices = Array.from({ length: 15 }, (_, i) =>
      1.30 + (i % 2 === 0 ? 0.01 : -0.01)
    );
    const result = classifier.classify("GBP/USD", prices);
    expect(result.regime).toBe("trending");
    expect(result.atrPercent).toBeGreaterThan(1);
    expect(result.atrPercent).toBeLessThan(3);
    expect(result.confidence).toBe(0.6);
  });

  it("classifies high ATR as 'volatile'", () => {
    // 15 prices with large changes: ATR% > 3%
    const prices = Array.from({ length: 15 }, (_, i) =>
      1.30 + (i % 2 === 0 ? 0.05 : -0.05)
    );
    const result = classifier.classify("GBP/USD", prices);
    expect(result.regime).toBe("volatile");
    expect(result.atrPercent).toBeGreaterThan(3);
    expect(result.confidence).toBe(0.7);
  });

  it("sets the correct instrument in output", () => {
    const result = classifier.classify("BTC/USD", [1.0]);
    expect(result.instrument).toBe("BTC/USD");
  });

  it("createMarketStateClassifier factory returns instance", () => {
    const c = createMarketStateClassifier();
    expect(c).toBeInstanceOf(MarketStateClassifier);
  });
});
