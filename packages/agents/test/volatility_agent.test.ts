// ============================================================================
// Volatility Agent Tests — ATR compression/expansion detection
// ============================================================================

import { describe, it, expect } from "vitest";
import { VolatilityAgent, createVolatilityAgent } from "../src/volatility_agent/index.js";
import type { MarketDataSnapshot } from "../src/shared_agent_protocols.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSnapshot(
  prices: number[],
  currentPrice?: number
): MarketDataSnapshot {
  return {
    instrument: "GBP/USD",
    assetClass: "fx",
    currentPrice: currentPrice ?? prices[0] ?? 1.30,
    open: 1.29,
    high: 1.31,
    low: 1.28,
    close: 1.30,
    volume: 10000,
    priceHistory: prices,
    timeframeMinutes: 60,
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("VolatilityAgent", () => {
  const agent = new VolatilityAgent();

  it("getMeta returns correct metadata", () => {
    const meta = agent.getMeta();
    expect(meta.agentId).toBe("volatility_agent");
    expect(meta.name).toBe("Volatility Agent");
    expect(meta.enabled).toBe(true);
  });

  it("returns null when priceHistory < 50", () => {
    const result = agent.analyze(makeSnapshot(Array(49).fill(1.30)));
    expect(result).toBeNull();
  });

  it("returns null when no compression detected (volRatio > 0.6)", () => {
    // Uniform step → ATR14 ≈ ATR50 → ratio ≈ 1.0
    const prices = Array.from({ length: 55 }, (_, i) =>
      1.30 + (i % 2 === 0 ? 0.005 : -0.005)
    );
    const result = agent.analyze(makeSnapshot(prices));
    expect(result).toBeNull();
  });

  it("returns signal when volatility compression is detected (ATR14 << ATR50)", () => {
    // Recent 15 prices: very tight range (tiny moves)
    const tight = Array.from({ length: 15 }, (_, i) =>
      1.30 + (i % 2 === 0 ? 0.0001 : -0.0001)
    );
    // Older 40 prices: wide swings (large moves)
    const wide = Array.from({ length: 40 }, (_, i) =>
      1.30 + (i % 2 === 0 ? 0.01 : -0.01)
    );
    const prices = [...tight, ...wide]; // 55 prices total

    const result = agent.analyze(makeSnapshot(prices, 1.3002));

    expect(result).not.toBeNull();
    expect(result!.agentId).toBe("volatility_agent");
    expect(["long", "short"]).toContain(result!.direction);
    expect(result!.confidence).toBeGreaterThan(0);
    expect(result!.confidence).toBeLessThanOrEqual(1);
    expect(result!.signalId).toBeTruthy();
    expect(result!.justification).toMatch(/compression/i);
  });

  it("direction is long when current price > recent midpoint", () => {
    const tight = Array.from({ length: 15 }, () => 1.30);
    const wide = Array.from({ length: 40 }, (_, i) =>
      1.30 + (i % 2 === 0 ? 0.02 : -0.02)
    );
    const prices = [...tight, ...wide];
    // currentPrice above midpoint of first 5 prices → long
    const result = agent.analyze(makeSnapshot(prices, 1.305));

    expect(result).not.toBeNull();
    expect(result!.direction).toBe("long");
  });

  it("createVolatilityAgent factory returns instance", () => {
    expect(createVolatilityAgent()).toBeInstanceOf(VolatilityAgent);
  });
});
