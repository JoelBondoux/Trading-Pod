// ============================================================================
// Zod Schema Tests — Runtime validation for all message types
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  AgentSignalSchema,
  FCDecisionSchema,
  CapitalRequestSchema,
  CapitalResponseSchema,
  CapitalReturnSchema,
  TradeExecutionSchema,
  TradingViewWebhookSchema,
  WeightedConsensusSchema,
  RiskCheckSchema,
} from "../src/schemas/index.js";

// ---------------------------------------------------------------------------
// Helpers — valid payloads
// ---------------------------------------------------------------------------

const validSignal = {
  signalId: "00000000-0000-0000-0000-000000000001",
  agentId: "trend_agent",
  source: "internal",
  assetClass: "fx",
  instrument: "GBP/USD",
  direction: "long",
  confidence: 0.85,
  stopLoss: 1.25,
  takeProfit: 1.35,
  holdingTimeMinutes: 240,
  justification: "MA crossover detected",
  currentPrice: 1.30,
  timestamp: "2026-01-15T10:00:00.000Z",
};

const validConsensus = {
  direction: "long",
  confidence: 0.8,
  signalCount: 2,
  weightedScore: 0.75,
};

const validDecision = {
  decisionId: "00000000-0000-0000-0000-000000000002",
  consensus: validConsensus,
  riskChecks: [{ rule: "min_rr", passed: true }],
  allRiskChecksPassed: true,
  capitalRequested: 500,
  capitalApproved: true,
  approved: true,
  contributingSignals: [validSignal],
  timestamp: "2026-01-15T10:00:01.000Z",
};

// ---------------------------------------------------------------------------
// AgentSignalSchema
// ---------------------------------------------------------------------------

describe("AgentSignalSchema", () => {
  it("accepts a valid signal", () => {
    expect(AgentSignalSchema.parse(validSignal)).toBeTruthy();
  });

  it("rejects non-UUID signalId", () => {
    expect(() => AgentSignalSchema.parse({ ...validSignal, signalId: "bad" })).toThrow();
  });

  it("rejects confidence > 1", () => {
    expect(() =>
      AgentSignalSchema.parse({ ...validSignal, confidence: 1.5 })
    ).toThrow();
  });

  it("rejects confidence < 0", () => {
    expect(() =>
      AgentSignalSchema.parse({ ...validSignal, confidence: -0.1 })
    ).toThrow();
  });

  it("rejects negative stopLoss", () => {
    expect(() =>
      AgentSignalSchema.parse({ ...validSignal, stopLoss: -1 })
    ).toThrow();
  });

  it("rejects invalid direction", () => {
    expect(() =>
      AgentSignalSchema.parse({ ...validSignal, direction: "up" })
    ).toThrow();
  });

  it("rejects invalid asset class", () => {
    expect(() =>
      AgentSignalSchema.parse({ ...validSignal, assetClass: "stocks" })
    ).toThrow();
  });

  it("rejects empty agentId", () => {
    expect(() =>
      AgentSignalSchema.parse({ ...validSignal, agentId: "" })
    ).toThrow();
  });

  it("rejects missing required fields", () => {
    const { instrument, ...incomplete } = validSignal;
    expect(() => AgentSignalSchema.parse(incomplete)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// WeightedConsensusSchema & RiskCheckSchema
// ---------------------------------------------------------------------------

describe("WeightedConsensusSchema", () => {
  it("accepts a valid consensus", () => {
    expect(WeightedConsensusSchema.parse(validConsensus)).toBeTruthy();
  });

  it("rejects negative signalCount", () => {
    expect(() =>
      WeightedConsensusSchema.parse({ ...validConsensus, signalCount: -1 })
    ).toThrow();
  });
});

describe("RiskCheckSchema", () => {
  it("accepts a valid risk check", () => {
    expect(RiskCheckSchema.parse({ rule: "min_rr", passed: true })).toBeTruthy();
  });

  it("accepts optional reason", () => {
    const rc = RiskCheckSchema.parse({ rule: "min_rr", passed: false, reason: "Too low" });
    expect(rc.reason).toBe("Too low");
  });
});

// ---------------------------------------------------------------------------
// FCDecisionSchema
// ---------------------------------------------------------------------------

describe("FCDecisionSchema", () => {
  it("accepts a valid decision", () => {
    expect(FCDecisionSchema.parse(validDecision)).toBeTruthy();
  });

  it("rejects non-UUID decisionId", () => {
    expect(() =>
      FCDecisionSchema.parse({ ...validDecision, decisionId: "bad" })
    ).toThrow();
  });

  it("accepts optional rejectionReason", () => {
    const d = FCDecisionSchema.parse({
      ...validDecision,
      approved: false,
      rejectionReason: "Low confidence",
    });
    expect(d.rejectionReason).toBe("Low confidence");
  });
});

// ---------------------------------------------------------------------------
// CapitalRequestSchema / CapitalResponseSchema / CapitalReturnSchema
// ---------------------------------------------------------------------------

describe("CapitalRequestSchema", () => {
  it("accepts a valid request", () => {
    expect(
      CapitalRequestSchema.parse({
        decisionId: "00000000-0000-0000-0000-000000000003",
        amount: 500,
        assetClass: "fx",
        instrument: "GBP/USD",
        timestamp: "2026-01-15T10:00:00.000Z",
      })
    ).toBeTruthy();
  });

  it("rejects zero amount", () => {
    expect(() =>
      CapitalRequestSchema.parse({
        decisionId: "00000000-0000-0000-0000-000000000003",
        amount: 0,
        assetClass: "fx",
        instrument: "GBP/USD",
        timestamp: "2026-01-15T10:00:00.000Z",
      })
    ).toThrow();
  });
});

describe("CapitalResponseSchema", () => {
  it("accepts a valid response", () => {
    expect(
      CapitalResponseSchema.parse({
        approved: true,
        allocatedAmount: 500,
        dailyRemaining: 4500,
        timestamp: "2026-01-15T10:00:00.000Z",
      })
    ).toBeTruthy();
  });
});

describe("CapitalReturnSchema", () => {
  it("accepts a valid return with negative PnL", () => {
    const r = CapitalReturnSchema.parse({
      executionId: "00000000-0000-0000-0000-000000000004",
      capitalReturned: 480,
      pnl: -20,
      assetClass: "crypto",
      timestamp: "2026-01-15T12:00:00.000Z",
    });
    expect(r.pnl).toBe(-20);
  });
});

// ---------------------------------------------------------------------------
// TradeExecutionSchema
// ---------------------------------------------------------------------------

describe("TradeExecutionSchema", () => {
  it("accepts a valid filled execution", () => {
    expect(
      TradeExecutionSchema.parse({
        executionId: "00000000-0000-0000-0000-000000000005",
        decisionId: "00000000-0000-0000-0000-000000000002",
        assetClass: "fx",
        instrument: "GBP/USD",
        direction: "long",
        entryPrice: 1.3001,
        stopLoss: 1.25,
        takeProfit: 1.35,
        positionSize: 384.6,
        capitalAllocated: 500,
        spread: 0.0002,
        slippage: 0.0001,
        broker: "mock",
        status: "filled",
        fees: 0,
        openedAt: "2026-01-15T10:00:02.000Z",
      })
    ).toBeTruthy();
  });

  it("accepts optional exitPrice, pnl, closedAt for closed trades", () => {
    const t = TradeExecutionSchema.parse({
      executionId: "00000000-0000-0000-0000-000000000005",
      decisionId: "00000000-0000-0000-0000-000000000002",
      assetClass: "fx",
      instrument: "GBP/USD",
      direction: "long",
      entryPrice: 1.30,
      stopLoss: 1.25,
      takeProfit: 1.35,
      positionSize: 1000,
      capitalAllocated: 1300,
      spread: 0,
      slippage: 0,
      broker: "mock",
      status: "closed",
      exitPrice: 1.32,
      pnl: 18,
      fees: 2,
      openedAt: "2026-01-15T10:00:00.000Z",
      closedAt: "2026-01-15T14:00:00.000Z",
    });
    expect(t.status).toBe("closed");
    expect(t.pnl).toBe(18);
  });

  it("rejects invalid status value", () => {
    expect(() =>
      TradeExecutionSchema.parse({
        executionId: "00000000-0000-0000-0000-000000000005",
        decisionId: "00000000-0000-0000-0000-000000000002",
        assetClass: "fx",
        instrument: "GBP/USD",
        direction: "long",
        entryPrice: 1.30,
        stopLoss: 1.25,
        takeProfit: 1.35,
        positionSize: 1000,
        capitalAllocated: 1300,
        spread: 0,
        slippage: 0,
        broker: "mock",
        status: "unknown_status",
        fees: 0,
        openedAt: "2026-01-15T10:00:00.000Z",
      })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// TradingViewWebhookSchema
// ---------------------------------------------------------------------------

describe("TradingViewWebhookSchema", () => {
  it("accepts a valid webhook with defaults", () => {
    const w = TradingViewWebhookSchema.parse({
      secret: "tv-secret",
      ticker: "GBPUSD",
      action: "buy",
      price: 1.30,
      stopLoss: 1.25,
      takeProfit: 1.35,
      assetClass: "fx",
    });
    expect(w.confidence).toBe(0.7); // default
    expect(w.holdingTimeMinutes).toBe(60); // default
    expect(w.justification).toBe("TradingView alert signal"); // default
    expect(w.agentId).toBe("tradingview_pine"); // default
  });

  it("accepts overridden defaults", () => {
    const w = TradingViewWebhookSchema.parse({
      secret: "tv-secret",
      ticker: "BTCUSD",
      action: "sell",
      price: 30000,
      stopLoss: 31000,
      takeProfit: 28000,
      assetClass: "crypto",
      confidence: 0.9,
      holdingTimeMinutes: 120,
      justification: "Custom alert",
      agentId: "custom_agent",
    });
    expect(w.confidence).toBe(0.9);
    expect(w.holdingTimeMinutes).toBe(120);
  });

  it("rejects invalid action", () => {
    expect(() =>
      TradingViewWebhookSchema.parse({
        secret: "tv-secret",
        ticker: "GBPUSD",
        action: "hold",
        price: 1.30,
        stopLoss: 1.25,
        takeProfit: 1.35,
        assetClass: "fx",
      })
    ).toThrow();
  });

  it("rejects missing required fields", () => {
    expect(() =>
      TradingViewWebhookSchema.parse({ secret: "tv-secret" })
    ).toThrow();
  });
});
