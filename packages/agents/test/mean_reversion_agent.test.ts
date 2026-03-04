// ============================================================================
// Mean Reversion Agent Tests — Z-score extremes signal generation
// ============================================================================

import { describe, it, expect } from "vitest";
import { MeanReversionAgent, createMeanReversionAgent } from "../src/mean_reversion_agent/index.js";
import type { MarketDataSnapshot } from "../src/shared_agent_protocols.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSnapshot(
  prices: number[],
  currentPrice?: number
): MarketDataSnapshot {
  return {
    instrument: "EUR/USD",
    assetClass: "fx",
    currentPrice: currentPrice ?? prices[0] ?? 1.10,
    open: 1.09,
    high: 1.11,
    low: 1.08,
    close: 1.10,
    volume: 8000,
    priceHistory: prices,
    timeframeMinutes: 60,
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MeanReversionAgent", () => {
  const agent = new MeanReversionAgent();

  it("getMeta returns correct metadata", () => {
    const meta = agent.getMeta();
    expect(meta.agentId).toBe("mean_reversion_agent");
    expect(meta.name).toBe("Mean Reversion Agent");
    expect(meta.enabled).toBe(true);
  });

  it("returns null when priceHistory < 30", () => {
    const result = agent.analyze(makeSnapshot(Array(29).fill(1.10)));
    expect(result).toBeNull();
  });

  it("returns null when z-score < 2 (price near mean)", () => {
    // All same price → z-score ≈ 0 if stdDev ≈ 0
    const prices = Array.from({ length: 40 }, (_, i) =>
      1.10 + (i % 2 === 0 ? 0.0001 : -0.0001)
    );
    const result = agent.analyze(makeSnapshot(prices, 1.10));
    expect(result).toBeNull();
  });

  it("returns null when stdDev is zero (all identical prices)", () => {
    const prices = Array(40).fill(1.10);
    const result = agent.analyze(makeSnapshot(prices, 1.10));
    expect(result).toBeNull();
  });

  it("returns short signal when price is far above mean (z-score > 2)", () => {
    // Alternating prices around 1.10 with tiny variance
    const prices = Array.from({ length: 40 }, (_, i) =>
      1.10 + (i % 2 === 0 ? 0.001 : -0.001)
    );
    // currentPrice much higher than mean → z-score > 2 → short
    const result = agent.analyze(makeSnapshot(prices, 1.108));

    expect(result).not.toBeNull();
    expect(result!.direction).toBe("short");
    expect(result!.agentId).toBe("mean_reversion_agent");
    expect(result!.confidence).toBeGreaterThan(0);
    expect(result!.confidence).toBeLessThanOrEqual(1);
    expect(result!.signalId).toBeTruthy();
  });

  it("returns long signal when price is far below mean (z-score < -2)", () => {
    const prices = Array.from({ length: 40 }, (_, i) =>
      1.10 + (i % 2 === 0 ? 0.001 : -0.001)
    );
    // currentPrice much lower than mean → z-score < -2 → long
    const result = agent.analyze(makeSnapshot(prices, 1.092));

    expect(result).not.toBeNull();
    expect(result!.direction).toBe("long");
  });

  it("createMeanReversionAgent factory returns instance", () => {
    expect(createMeanReversionAgent()).toBeInstanceOf(MeanReversionAgent);
  });
});
