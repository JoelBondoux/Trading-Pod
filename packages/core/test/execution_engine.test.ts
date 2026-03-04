// ============================================================================
// Execution Engine Tests — Trade execution, broker interaction, PnL calculation
// ============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExecutionEngine } from "../src/execution_engine/engine.js";
import type { BrokerAdapter } from "../src/execution_engine/broker_adapter.js";
import type { FCDecision, CapitalResponse, AgentSignal } from "@trading-pod/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSignal(overrides: Partial<AgentSignal> = {}): AgentSignal {
  return {
    signalId: "sig-1",
    agentId: "trend_agent",
    source: "internal",
    assetClass: "fx",
    instrument: "GBP/USD",
    direction: "long",
    confidence: 0.8,
    stopLoss: 1.25,
    takeProfit: 1.35,
    holdingTimeMinutes: 240,
    justification: "test signal",
    currentPrice: 1.30,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function makeDecision(overrides: Partial<FCDecision> = {}): FCDecision {
  return {
    decisionId: "dec-1",
    consensus: { direction: "long", confidence: 0.8, signalCount: 1, weightedScore: 0.8 },
    riskChecks: [{ rule: "min_rr", passed: true }],
    allRiskChecksPassed: true,
    capitalRequested: 500,
    capitalApproved: true,
    approved: true,
    contributingSignals: [makeSignal()],
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function makeCapitalResponse(overrides: Partial<CapitalResponse> = {}): CapitalResponse {
  return {
    approved: true,
    allocatedAmount: 500,
    dailyRemaining: 4500,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function makeMockBroker(overrides: Record<string, unknown> = {}): BrokerAdapter {
  return {
    name: "mock",
    placeOrder: vi.fn().mockResolvedValue({
      orderId: "mock-001",
      status: "accepted",
      filledPrice: 1.3001,
      filledSize: 384.6,
      fees: 0,
      timestamp: new Date().toISOString(),
    }),
    cancelOrder: vi.fn().mockResolvedValue(true),
    healthCheck: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests — happy path
// ---------------------------------------------------------------------------

describe("ExecutionEngine.execute — happy path", () => {
  it("executes an approved decision via broker", async () => {
    const broker = makeMockBroker();
    const engine = new ExecutionEngine(broker);

    const result = await engine.execute(makeDecision(), makeCapitalResponse());

    expect(result.status).toBe("filled");
    expect(result.instrument).toBe("GBP/USD");
    expect(result.direction).toBe("long");
    expect(result.entryPrice).toBe(1.3001);
    expect(result.capitalAllocated).toBe(500);
    expect(result.brokerOrderId).toBe("mock-001");
    expect(result.broker).toBe("mock");
    expect(result.fees).toBe(0);
    expect(result.executionId).toBeTruthy();
    expect(result.decisionId).toBe("dec-1");
    expect(broker.placeOrder).toHaveBeenCalledOnce();
  });

  it("calculates position size from allocated capital / current price", async () => {
    const broker = makeMockBroker();
    const engine = new ExecutionEngine(broker);

    await engine.execute(makeDecision(), makeCapitalResponse({ allocatedAmount: 1300 }));

    const call = (broker.placeOrder as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // 1300 / 1.30 = 1000
    expect(call.size).toBeCloseTo(1000, 1);
  });
});

// ---------------------------------------------------------------------------
// Tests — failure paths
// ---------------------------------------------------------------------------

describe("ExecutionEngine.execute — failure paths", () => {
  it("returns error when decision not approved", async () => {
    const broker = makeMockBroker();
    const engine = new ExecutionEngine(broker);

    const result = await engine.execute(
      makeDecision({ approved: false }),
      makeCapitalResponse()
    );

    expect(result.status).toBe("error");
    expect(result.errorMessage).toMatch(/not approved/i);
    expect(broker.placeOrder).not.toHaveBeenCalled();
  });

  it("returns error when capital not approved", async () => {
    const broker = makeMockBroker();
    const engine = new ExecutionEngine(broker);

    const result = await engine.execute(
      makeDecision(),
      makeCapitalResponse({ approved: false })
    );

    expect(result.status).toBe("error");
    expect(result.errorMessage).toMatch(/not approved/i);
  });

  it("returns error when no signal matches consensus direction", async () => {
    const broker = makeMockBroker();
    const engine = new ExecutionEngine(broker);

    const decision = makeDecision({
      consensus: { direction: "short", confidence: 0.8, signalCount: 1, weightedScore: 0.8 },
      contributingSignals: [makeSignal({ direction: "long" })], // no short signal
    });

    const result = await engine.execute(decision, makeCapitalResponse());

    expect(result.status).toBe("error");
    expect(result.errorMessage).toMatch(/No signal found/);
  });

  it("returns error when broker rejects order", async () => {
    const broker = makeMockBroker({
      placeOrder: vi.fn().mockResolvedValue({
        orderId: "mock-002",
        status: "rejected",
        fees: 0,
        timestamp: new Date().toISOString(),
        rejectionReason: "Insufficient margin",
      }),
    });
    const engine = new ExecutionEngine(broker);

    const result = await engine.execute(makeDecision(), makeCapitalResponse());

    expect(result.status).toBe("error");
    expect(result.errorMessage).toMatch(/Broker rejected/);
    expect(result.errorMessage).toMatch(/Insufficient margin/);
  });

  it("returns error when broker throws exception", async () => {
    const broker = makeMockBroker({
      placeOrder: vi.fn().mockRejectedValue(new Error("Network timeout")),
    });
    const engine = new ExecutionEngine(broker);

    const result = await engine.execute(makeDecision(), makeCapitalResponse());

    expect(result.status).toBe("error");
    expect(result.errorMessage).toMatch(/Broker error.*Network timeout/);
  });
});

// ---------------------------------------------------------------------------
// Tests — close position
// ---------------------------------------------------------------------------

describe("ExecutionEngine.closePosition", () => {
  const engine = new ExecutionEngine(makeMockBroker());

  const baseExecution = {
    executionId: "exec-1",
    decisionId: "dec-1",
    assetClass: "fx" as const,
    instrument: "GBP/USD",
    direction: "long" as const,
    entryPrice: 1.30,
    stopLoss: 1.25,
    takeProfit: 1.35,
    positionSize: 1000,
    capitalAllocated: 1300,
    spread: 0.0001,
    slippage: 0.0001,
    broker: "mock",
    status: "filled" as const,
    fees: 2,
    openedAt: new Date().toISOString(),
  };

  it("computes positive PnL for a profitable long", async () => {
    const result = await engine.closePosition(baseExecution, 1.32);
    expect(result.status).toBe("closed");
    expect(result.exitPrice).toBe(1.32);
    // pnl = (1.32 - 1.30) * 1000 - 2 = 20 - 2 = 18
    expect(result.pnl).toBeCloseTo(18, 2);
    expect(result.closedAt).toBeTruthy();
  });

  it("computes negative PnL for a losing long", async () => {
    const result = await engine.closePosition(baseExecution, 1.28);
    // pnl = (1.28 - 1.30) * 1000 - 2 = -20 - 2 = -22
    expect(result.pnl).toBeCloseTo(-22, 2);
  });

  it("computes positive PnL for a profitable short", async () => {
    const shortExec = { ...baseExecution, direction: "short" as const, entryPrice: 1.30 };
    const result = await engine.closePosition(shortExec, 1.28);
    // pnl = (1.30 - 1.28) * 1000 - 2 = 20 - 2 = 18
    expect(result.pnl).toBeCloseTo(18, 2);
  });

  it("computes negative PnL for a losing short", async () => {
    const shortExec = { ...baseExecution, direction: "short" as const, entryPrice: 1.30 };
    const result = await engine.closePosition(shortExec, 1.32);
    // pnl = (1.30 - 1.32) * 1000 - 2 = -20 - 2 = -22
    expect(result.pnl).toBeCloseTo(-22, 2);
  });

  it("handles break-even exit (PnL equals negative fees)", async () => {
    const result = await engine.closePosition(baseExecution, 1.30);
    // pnl = (1.30 - 1.30) * 1000 - 2 = -2 (fees only)
    expect(result.pnl).toBeCloseTo(-2, 2);
  });
});
