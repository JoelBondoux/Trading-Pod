// ============================================================================
// Treasurer Tests — Capital gating, scale factor, profit split
// ============================================================================

import { describe, it, expect, beforeEach } from "vitest";
import { Treasurer } from "../src/treasurer/treasurer.js";
import type { CapitalRequest, CapitalReturn } from "@trading-pod/shared";

// ---------------------------------------------------------------------------
// requestCapital
// ---------------------------------------------------------------------------

describe("Treasurer.requestCapital", () => {
  let t: Treasurer;

  beforeEach(() => {
    t = new Treasurer({
      baseCapital: 10_000,
      dailyAllocated: 0,
      scaleFactor: 0.01,     // 1% → max £100 per trade
      minScaleFactor: 0.005,
      maxScaleFactor: 0.05,
    });
  });

  it("approves a request within scale factor and ceiling", () => {
    const req: CapitalRequest = {
      decisionId: "d-1",
      amount: 80,
      assetClass: "fx",
      instrument: "GBP/USD",
      timestamp: new Date().toISOString(),
    };
    const res = t.requestCapital(req);
    expect(res.approved).toBe(true);
    expect(res.allocatedAmount).toBe(80);
    expect(res.dailyRemaining).toBe(1000 - 80); // ceiling = 10% of 10k = 1000
  });

  it("caps allocation at scale factor", () => {
    // Requesting more than 1% of 10k = 100
    const req: CapitalRequest = {
      decisionId: "d-1",
      amount: 500,
      assetClass: "fx",
      instrument: "GBP/USD",
      timestamp: new Date().toISOString(),
    };
    const res = t.requestCapital(req);
    expect(res.approved).toBe(true);
    expect(res.allocatedAmount).toBe(100); // capped at scaleFactor * baseCapital
  });

  it("rejects when daily ceiling reached", () => {
    // Fill up the daily ceiling
    t = new Treasurer({
      baseCapital: 10_000,
      dailyAllocated: 1000,
      scaleFactor: 0.01,
    });
    const req: CapitalRequest = {
      decisionId: "d-1",
      amount: 50,
      assetClass: "fx",
      instrument: "GBP/USD",
      timestamp: new Date().toISOString(),
    };
    const res = t.requestCapital(req);
    expect(res.approved).toBe(false);
    expect(res.allocatedAmount).toBe(0);
    expect(res.rejectionReason).toContain("ceiling");
  });

  it("caps at remaining daily capacity", () => {
    t = new Treasurer({
      baseCapital: 10_000,
      dailyAllocated: 960,
      scaleFactor: 0.01,
    });
    const req: CapitalRequest = {
      decisionId: "d-1",
      amount: 100,
      assetClass: "fx",
      instrument: "GBP/USD",
      timestamp: new Date().toISOString(),
    };
    const res = t.requestCapital(req);
    expect(res.approved).toBe(true);
    expect(res.allocatedAmount).toBe(40); // only 40 remaining
  });
});

// ---------------------------------------------------------------------------
// returnCapital — profit split
// ---------------------------------------------------------------------------

describe("Treasurer.returnCapital", () => {
  it("splits profit 50/50 between Treasurer and Savings", () => {
    const t = new Treasurer({ baseCapital: 10_000, scaleFactor: 0.01 });

    const ret: CapitalReturn = {
      executionId: "e-1",
      capitalReturned: 100,
      pnl: 20,
      assetClass: "fx",
      timestamp: new Date().toISOString(),
    };

    const result = t.returnCapital(ret);
    expect(result.savingsAmount).toBe(10); // 50% of 20
    expect(result.taxableProfit).toBe(20);

    // Base capital should have original + returned capital + treasurer's 50% share
    const state = t.getState();
    expect(state.baseCapital).toBe(10_000 + 100 + 10);
  });

  it("absorbs loss from base capital", () => {
    const t = new Treasurer({ baseCapital: 10_000, scaleFactor: 0.01 });

    const ret: CapitalReturn = {
      executionId: "e-1",
      capitalReturned: 80, // returned less than allocated
      pnl: -20,
      assetClass: "crypto",
      timestamp: new Date().toISOString(),
    };

    const result = t.returnCapital(ret);
    expect(result.savingsAmount).toBe(0);
    expect(result.taxableProfit).toBe(0);

    // Base: 10000 + 80 (returned) + (-20) (loss) = 10060
    const state = t.getState();
    expect(state.baseCapital).toBe(10_060);
  });

  it("returns crypto asset class for tax processing", () => {
    const t = new Treasurer({ baseCapital: 10_000, scaleFactor: 0.01 });
    const ret: CapitalReturn = {
      executionId: "e-1",
      capitalReturned: 100,
      pnl: 50,
      assetClass: "crypto",
      timestamp: new Date().toISOString(),
    };
    const result = t.returnCapital(ret);
    expect(result.assetClass).toBe("crypto");
  });

  it("break-even trade (pnl=0) produces zero savings", () => {
    const t = new Treasurer({ baseCapital: 10_000, scaleFactor: 0.01 });
    const ret: CapitalReturn = {
      executionId: "e-1",
      capitalReturned: 100,
      pnl: 0,
      assetClass: "fx",
      timestamp: new Date().toISOString(),
    };
    const result = t.returnCapital(ret);
    expect(result.savingsAmount).toBe(0);
    expect(result.taxableProfit).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// adjustScaleFactor
// ---------------------------------------------------------------------------

describe("Treasurer scale factor adjustment", () => {
  it("increases scale factor after consistent wins", () => {
    const t = new Treasurer({
      baseCapital: 10_000,
      scaleFactor: 0.01,
      rollingPnL: [],
    });

    // 6 winning trades
    for (let i = 0; i < 6; i++) {
      t.returnCapital({
        executionId: `e-${i}`,
        capitalReturned: 100,
        pnl: 10,
        assetClass: "fx",
        timestamp: new Date().toISOString(),
      });
    }

    const state = t.getState();
    // scaleFactor should have increased from 0.01 (only after 5+ trades)
    // adjustScaleFactor fires on each return; first 4 returns skip (< 5 trades)
    // 5th return: all wins (PnL > 0, winRate = 1.0) → 0.01 * 1.05
    // 6th return: same → 0.01 * 1.05^2
    expect(state.scaleFactor).toBeGreaterThan(0.01);
  });

  it("decreases scale factor after losses", () => {
    const t = new Treasurer({
      baseCapital: 10_000,
      scaleFactor: 0.02,
      rollingPnL: [],
    });

    // 6 losing trades
    for (let i = 0; i < 6; i++) {
      t.returnCapital({
        executionId: `e-${i}`,
        capitalReturned: 90,
        pnl: -10,
        assetClass: "fx",
        timestamp: new Date().toISOString(),
      });
    }

    const state = t.getState();
    expect(state.scaleFactor).toBeLessThan(0.02);
  });

  it("does not adjust with < 5 trades in rolling window", () => {
    const t = new Treasurer({
      baseCapital: 10_000,
      scaleFactor: 0.01,
      rollingPnL: [],
    });

    // Only 3 trades
    for (let i = 0; i < 3; i++) {
      t.returnCapital({
        executionId: `e-${i}`,
        capitalReturned: 100,
        pnl: 50,
        assetClass: "fx",
        timestamp: new Date().toISOString(),
      });
    }

    expect(t.getState().scaleFactor).toBe(0.01);
  });

  it("respects maxScaleFactor ceiling", () => {
    const t = new Treasurer({
      baseCapital: 10_000,
      scaleFactor: 0.049,
      maxScaleFactor: 0.05,
      rollingPnL: [10, 10, 10, 10, 10], // pre-loaded wins
    });

    t.returnCapital({
      executionId: "e-1",
      capitalReturned: 100,
      pnl: 50,
      assetClass: "fx",
      timestamp: new Date().toISOString(),
    });

    expect(t.getState().scaleFactor).toBeLessThanOrEqual(0.05);
  });

  it("respects minScaleFactor floor", () => {
    const t = new Treasurer({
      baseCapital: 10_000,
      scaleFactor: 0.006,
      minScaleFactor: 0.005,
      rollingPnL: [-10, -10, -10, -10, -10], // pre-loaded losses
    });

    t.returnCapital({
      executionId: "e-1",
      capitalReturned: 90,
      pnl: -10,
      assetClass: "fx",
      timestamp: new Date().toISOString(),
    });

    expect(t.getState().scaleFactor).toBeGreaterThanOrEqual(0.005);
  });
});

// ---------------------------------------------------------------------------
// Rolling PnL window
// ---------------------------------------------------------------------------

describe("Treasurer rolling PnL", () => {
  it("trims rolling window to configured size", () => {
    const t = new Treasurer({
      baseCapital: 10_000,
      scaleFactor: 0.01,
      rollingWindowSize: 5,
      rollingPnL: [],
    });

    for (let i = 0; i < 10; i++) {
      t.returnCapital({
        executionId: `e-${i}`,
        capitalReturned: 100,
        pnl: i % 2 === 0 ? 10 : -5,
        assetClass: "fx",
        timestamp: new Date().toISOString(),
      });
    }

    expect(t.getState().rollingPnL).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// State persistence
// ---------------------------------------------------------------------------

describe("Treasurer state management", () => {
  it("getState returns a copy", () => {
    const t = new Treasurer({ baseCapital: 10_000 });
    const s1 = t.getState();
    s1.baseCapital = 0;
    expect(t.getState().baseCapital).toBe(10_000);
  });

  it("loadState replaces internal state", () => {
    const t = new Treasurer({ baseCapital: 10_000 });
    const snapshot = t.getState();
    snapshot.baseCapital = 5000;
    t.loadState(snapshot);
    expect(t.getState().baseCapital).toBe(5000);
  });
});
