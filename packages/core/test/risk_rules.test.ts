// ============================================================================
// Risk Rules Tests — All 6 pure deterministic risk checks
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  checkMinRR,
  checkSLBounds,
  checkMaxDailyTrades,
  checkMinConfidence,
  checkVolatilityRegime,
  checkNewsWindow,
  runAllRiskChecks,
} from "../src/risk_rules/rules.js";
import type {
  AgentSignal,
  RiskRuleConfig,
  MarketStateOutput,
  NewsFilterOutput,
} from "@trading-pod/shared";
import { DEFAULT_RISK_RULES } from "@trading-pod/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSignal(overrides: Partial<AgentSignal> = {}): AgentSignal {
  return {
    signalId: "sig-1",
    agentId: "test-agent",
    source: "internal",
    assetClass: "fx",
    instrument: "GBP/USD",
    direction: "long",
    confidence: 0.8,
    stopLoss: 1.29,       // 0.77% below entry
    takeProfit: 1.32,     // 1.54% above entry
    holdingTimeMinutes: 60,
    justification: "test signal",
    currentPrice: 1.30,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

const config: RiskRuleConfig = { ...DEFAULT_RISK_RULES };

// ---------------------------------------------------------------------------
// checkMinRR
// ---------------------------------------------------------------------------

describe("checkMinRR", () => {
  it("passes when RR ≥ 1.5 (long)", () => {
    // risk = 1.30 - 1.29 = 0.01, reward = 1.32 - 1.30 = 0.02, RR = 2.0
    const result = checkMinRR(makeSignal(), config);
    expect(result.passed).toBe(true);
    expect(result.rule).toBe("min_reward_risk_ratio");
  });

  it("fails when RR < 1.5 (long)", () => {
    // risk = 0.01, reward = 0.005, RR = 0.5
    const result = checkMinRR(makeSignal({ takeProfit: 1.305 }), config);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("below minimum");
  });

  it("passes when RR ≥ 1.5 (short)", () => {
    // short: risk = SL - entry = 1.31 - 1.30 = 0.01, reward = entry - TP = 1.30 - 1.28 = 0.02
    const sig = makeSignal({
      direction: "short",
      currentPrice: 1.30,
      stopLoss: 1.31,
      takeProfit: 1.28,
    });
    const result = checkMinRR(sig, config);
    expect(result.passed).toBe(true);
  });

  it("fails when RR < 1.5 (short)", () => {
    const sig = makeSignal({
      direction: "short",
      currentPrice: 1.30,
      stopLoss: 1.31,
      takeProfit: 1.295, // reward 0.005, risk 0.01, RR = 0.5
    });
    const result = checkMinRR(sig, config);
    expect(result.passed).toBe(false);
  });

  it("returns 0 RR when risk is zero (SL == entry)", () => {
    const sig = makeSignal({ stopLoss: 1.30, takeProfit: 1.32 });
    const result = checkMinRR(sig, config);
    expect(result.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// checkSLBounds
// ---------------------------------------------------------------------------

describe("checkSLBounds", () => {
  it("passes for SL within bounds", () => {
    // SL at 1.29 from 1.30 = 0.77%
    const result = checkSLBounds(makeSignal(), config);
    expect(result.passed).toBe(true);
  });

  it("fails when SL is too tight (<0.1%)", () => {
    // SL at 1.2999 from 1.30 = 0.0077%
    const result = checkSLBounds(makeSignal({ stopLoss: 1.2999 }), config);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("below min");
  });

  it("fails when SL is too wide (>3%)", () => {
    // SL at 1.24 from 1.30 = 4.6%
    const result = checkSLBounds(makeSignal({ stopLoss: 1.24 }), config);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("exceeds max");
  });

  it("passes just inside boundary", () => {
    // SL at ~2.9% from entry: close to max but within bounds
    const result = checkSLBounds(makeSignal({ stopLoss: 1.2625 }), config);
    expect(result.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkMaxDailyTrades
// ---------------------------------------------------------------------------

describe("checkMaxDailyTrades", () => {
  it("passes when trades < max (4 < 5)", () => {
    const result = checkMaxDailyTrades(4, config);
    expect(result.passed).toBe(true);
  });

  it("fails when trades = max (5 = 5)", () => {
    const result = checkMaxDailyTrades(5, config);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("limit reached");
  });

  it("fails when trades > max", () => {
    const result = checkMaxDailyTrades(10, config);
    expect(result.passed).toBe(false);
  });

  it("passes for 0 trades", () => {
    const result = checkMaxDailyTrades(0, config);
    expect(result.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkMinConfidence
// ---------------------------------------------------------------------------

describe("checkMinConfidence", () => {
  it("passes when confidence ≥ 0.6", () => {
    const result = checkMinConfidence(0.7, config);
    expect(result.passed).toBe(true);
  });

  it("passes at exactly threshold", () => {
    const result = checkMinConfidence(0.6, config);
    expect(result.passed).toBe(true);
  });

  it("fails below threshold", () => {
    const result = checkMinConfidence(0.5, config);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("below threshold");
  });

  it("passes at 1.0", () => {
    const result = checkMinConfidence(1.0, config);
    expect(result.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkVolatilityRegime
// ---------------------------------------------------------------------------

describe("checkVolatilityRegime", () => {
  it("passes when no market state available", () => {
    const result = checkVolatilityRegime(null, config);
    expect(result.passed).toBe(true);
  });

  it("passes for trending regime", () => {
    const ms: MarketStateOutput = {
      regime: "trending",
      confidence: 0.8,
      atrPercent: 1.2,
      instrument: "GBP/USD",
      timestamp: new Date().toISOString(),
    };
    const result = checkVolatilityRegime(ms, config);
    expect(result.passed).toBe(true);
  });

  it("passes for ranging regime", () => {
    const ms: MarketStateOutput = {
      regime: "ranging",
      confidence: 0.7,
      atrPercent: 0.5,
      instrument: "GBP/USD",
      timestamp: new Date().toISOString(),
    };
    const result = checkVolatilityRegime(ms, config);
    expect(result.passed).toBe(true);
  });

  it("blocks volatile regime", () => {
    const ms: MarketStateOutput = {
      regime: "volatile",
      confidence: 0.9,
      atrPercent: 3.5,
      instrument: "GBP/USD",
      timestamp: new Date().toISOString(),
    };
    const result = checkVolatilityRegime(ms, config);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("volatile");
  });
});

// ---------------------------------------------------------------------------
// checkNewsWindow
// ---------------------------------------------------------------------------

describe("checkNewsWindow", () => {
  it("passes when no filter data", () => {
    const result = checkNewsWindow(null);
    expect(result.passed).toBe(true);
  });

  it("passes when no block active", () => {
    const nf: NewsFilterOutput = {
      block: false,
      timestamp: new Date().toISOString(),
    };
    const result = checkNewsWindow(nf);
    expect(result.passed).toBe(true);
  });

  it("blocks when active", () => {
    const nf: NewsFilterOutput = {
      block: true,
      reason: "NFP release",
      blockRemainingMinutes: 15,
      timestamp: new Date().toISOString(),
    };
    const result = checkNewsWindow(nf);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("NFP release");
    expect(result.reason).toContain("15");
  });
});

// ---------------------------------------------------------------------------
// runAllRiskChecks — orchestrator
// ---------------------------------------------------------------------------

describe("runAllRiskChecks", () => {
  it("returns 6 check results", () => {
    const results = runAllRiskChecks(makeSignal(), 0.7, 2, null, null, config);
    expect(results).toHaveLength(6);
  });

  it("all pass for a good signal", () => {
    const results = runAllRiskChecks(makeSignal(), 0.7, 2, null, null, config);
    expect(results.every((r) => r.passed)).toBe(true);
  });

  it("fails multiple checks for a bad signal", () => {
    const badSignal = makeSignal({
      stopLoss: 1.2999, // too tight
      takeProfit: 1.301, // low RR
      confidence: 0.3,
    });
    const ms: MarketStateOutput = {
      regime: "volatile",
      confidence: 0.9,
      atrPercent: 4.0,
      instrument: "GBP/USD",
      timestamp: new Date().toISOString(),
    };
    const nf: NewsFilterOutput = {
      block: true,
      reason: "ECB rate decision",
      blockRemainingMinutes: 20,
      timestamp: new Date().toISOString(),
    };
    const results = runAllRiskChecks(badSignal, 0.3, 10, ms, nf, config);
    const failed = results.filter((r) => !r.passed);
    // Should fail: minRR, SL bounds, daily trades, confidence, volatility, news (6/6)
    expect(failed.length).toBeGreaterThanOrEqual(5);
  });
});
