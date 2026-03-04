// ============================================================================
// Trend Agent Tests — MA crossover signal generation
// ============================================================================

import { describe, it, expect } from "vitest";
import { TrendAgent, createTrendAgent } from "../src/trend_agent/index.js";
import type { MarketDataSnapshot } from "../src/shared_agent_protocols.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSnapshot(prices: number[], currentPrice?: number): MarketDataSnapshot {
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

describe("TrendAgent", () => {
  const agent = new TrendAgent();

  it("getMeta returns correct metadata", () => {
    const meta = agent.getMeta();
    expect(meta.agentId).toBe("trend_agent");
    expect(meta.name).toBe("Trend Agent");
    expect(meta.assetClasses).toContain("fx");
    expect(meta.assetClasses).toContain("crypto");
    expect(meta.enabled).toBe(true);
  });

  it("returns null when priceHistory < 50", () => {
    const result = agent.analyze(makeSnapshot(Array(49).fill(1.30)));
    expect(result).toBeNull();
  });

  it("returns null when MAs are too close (no clear trend)", () => {
    // 60 identical prices → fastMA ≈ slowMA → return null
    const result = agent.analyze(makeSnapshot(Array(60).fill(1.30)));
    expect(result).toBeNull();
  });

  it("returns long signal on uptrend (fast MA > slow MA)", () => {
    // Uptrend: most recent (index 0) is highest, oldest is lowest
    const prices = Array.from({ length: 60 }, (_, i) => 1.30 - i * 0.002);
    // fastMA(0-9) ≈ 1.291, slowMA(0-29) ≈ 1.271 → clear divergence
    const result = agent.analyze(makeSnapshot(prices));

    expect(result).not.toBeNull();
    expect(result!.direction).toBe("long");
    expect(result!.agentId).toBe("trend_agent");
    expect(result!.instrument).toBe("GBP/USD");
    expect(result!.assetClass).toBe("fx");
    expect(result!.confidence).toBeGreaterThan(0);
    expect(result!.confidence).toBeLessThanOrEqual(1);
    expect(result!.stopLoss).toBeLessThan(result!.currentPrice);
    expect(result!.takeProfit).toBeGreaterThan(result!.currentPrice);
    expect(result!.signalId).toBeTruthy();
  });

  it("returns short signal on downtrend (fast MA < slow MA)", () => {
    // Downtrend: most recent (index 0) is lowest, oldest is highest
    const prices = Array.from({ length: 60 }, (_, i) => 1.20 + i * 0.002);
    const result = agent.analyze(makeSnapshot(prices));

    expect(result).not.toBeNull();
    expect(result!.direction).toBe("short");
    expect(result!.stopLoss).toBeGreaterThan(result!.currentPrice);
    expect(result!.takeProfit).toBeLessThan(result!.currentPrice);
  });

  it("createTrendAgent factory returns instance", () => {
    expect(createTrendAgent()).toBeInstanceOf(TrendAgent);
  });
});
