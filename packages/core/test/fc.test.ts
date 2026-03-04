// ============================================================================
// Financial Controller Tests — Decision pipeline
// ============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { FinancialController, type FCDependencies } from "../src/financial_controller/fc.js";
import type { AgentSignal, CapitalResponse } from "@trading-pod/shared";
import { DEFAULT_RISK_RULES } from "@trading-pod/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSignal(overrides: Partial<AgentSignal> = {}): AgentSignal {
  return {
    signalId: "sig-1",
    agentId: "agent-A",
    source: "internal",
    assetClass: "fx",
    instrument: "GBP/USD",
    direction: "long",
    confidence: 0.85,
    stopLoss: 1.29,
    takeProfit: 1.32,
    holdingTimeMinutes: 60,
    justification: "momentum breakout",
    currentPrice: 1.30,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function makeDeps(overrides: Partial<FCDependencies> = {}): FCDependencies {
  return {
    getCredibilities: vi.fn().mockResolvedValue(new Map([["agent-A", 0.8], ["agent-B", 0.6]])),
    requestCapital: vi.fn().mockResolvedValue({
      approved: true,
      allocatedAmount: 100,
      dailyRemaining: 900,
      timestamp: new Date().toISOString(),
    } satisfies CapitalResponse),
    getDailyTradeCount: vi.fn().mockResolvedValue(2),
    getMarketState: vi.fn().mockResolvedValue(null),
    getNewsFilter: vi.fn().mockResolvedValue(null),
    emitEvent: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("FinancialController.decide — happy path", () => {
  it("approves a good signal", async () => {
    const deps = makeDeps();
    const fc = new FinancialController(deps);
    const decision = await fc.decide([makeSignal()]);

    expect(decision.approved).toBe(true);
    expect(decision.capitalApproved).toBe(true);
    expect(decision.allRiskChecksPassed).toBe(true);
    expect(decision.consensus.direction).toBe("long");
    expect(decision.contributingSignals).toHaveLength(1);
  });

  it("picks majority direction from multiple signals", async () => {
    const deps = makeDeps();
    const fc = new FinancialController(deps);

    const signals = [
      makeSignal({ agentId: "agent-A", direction: "long", confidence: 0.7 }),
      makeSignal({ agentId: "agent-B", direction: "long", confidence: 0.8 }),
      makeSignal({
        agentId: "agent-C",
        direction: "short",
        confidence: 0.9,
        stopLoss: 1.31,
        takeProfit: 1.28,
      }),
    ];

    // Add agent-C to credibility map
    (deps.getCredibilities as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Map([["agent-A", 0.5], ["agent-B", 0.5], ["agent-C", 0.5]])
    );

    const decision = await fc.decide(signals);
    expect(decision.consensus.direction).toBe("long");
  });
});

// ---------------------------------------------------------------------------
// Rejection cases
// ---------------------------------------------------------------------------

describe("FinancialController.decide — rejections", () => {
  it("rejects empty signals", async () => {
    const fc = new FinancialController(makeDeps());
    const decision = await fc.decide([]);

    expect(decision.approved).toBe(false);
    expect(decision.rejectionReason).toContain("No signals");
  });

  it("rejects when risk checks fail (low confidence)", async () => {
    const deps = makeDeps();
    const fc = new FinancialController(deps);

    // Signal with low confidence that will fail aggregated confidence check
    const signal = makeSignal({ confidence: 0.1 });
    // Also need credibility to be low so weighted confidence is below threshold
    (deps.getCredibilities as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Map([["agent-A", 0.2]])
    );

    const decision = await fc.decide([signal]);
    // Weighted confidence = 0.2 * 0.1 / 0.2 = 0.1, below 0.6 threshold
    expect(decision.approved).toBe(false);
    expect(decision.rejectionReason).toContain("Risk checks failed");
  });

  it("rejects when capital request denied", async () => {
    const deps = makeDeps({
      requestCapital: vi.fn().mockResolvedValue({
        approved: false,
        allocatedAmount: 0,
        rejectionReason: "Daily ceiling reached",
        dailyRemaining: 0,
        timestamp: new Date().toISOString(),
      } satisfies CapitalResponse),
    });

    const fc = new FinancialController(deps);
    const decision = await fc.decide([makeSignal()]);

    expect(decision.approved).toBe(false);
    expect(decision.capitalApproved).toBe(false);
    expect(decision.rejectionReason).toContain("Capital rejected");
  });

  it("rejects when daily trade limit exceeded", async () => {
    const deps = makeDeps({
      getDailyTradeCount: vi.fn().mockResolvedValue(5), // at limit
    });

    const fc = new FinancialController(deps);
    const decision = await fc.decide([makeSignal()]);

    expect(decision.approved).toBe(false);
    expect(decision.allRiskChecksPassed).toBe(false);
  });

  it("rejects during volatile regime", async () => {
    const deps = makeDeps({
      getMarketState: vi.fn().mockResolvedValue({
        regime: "volatile",
        confidence: 0.9,
        atrPercent: 4.0,
        instrument: "GBP/USD",
        timestamp: new Date().toISOString(),
      }),
    });

    const fc = new FinancialController(deps);
    const decision = await fc.decide([makeSignal()]);

    expect(decision.approved).toBe(false);
  });

  it("rejects during news window", async () => {
    const deps = makeDeps({
      getNewsFilter: vi.fn().mockResolvedValue({
        block: true,
        reason: "NFP",
        blockRemainingMinutes: 10,
        timestamp: new Date().toISOString(),
      }),
    });

    const fc = new FinancialController(deps);
    const decision = await fc.decide([makeSignal()]);

    expect(decision.approved).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Risk checks structure
// ---------------------------------------------------------------------------

describe("FinancialController risk checks output", () => {
  it("includes all 6 risk check results in decision", async () => {
    const fc = new FinancialController(makeDeps());
    const decision = await fc.decide([makeSignal()]);
    expect(decision.riskChecks).toHaveLength(6);
    expect(decision.riskChecks.map((r) => r.rule)).toEqual(
      expect.arrayContaining([
        "min_reward_risk_ratio",
        "stop_loss_bounds",
        "max_daily_trades",
        "min_confidence",
        "volatility_regime",
        "news_window",
      ])
    );
  });
});
