// ============================================================================
// Savings Manager Tests — One-way vault deposit + state persistence
// ============================================================================

import { describe, it, expect, beforeEach } from "vitest";
import { SavingsManager } from "../src/savings_manager/savings.js";

describe("SavingsManager.deposit", () => {
  let sm: SavingsManager;

  beforeEach(() => {
    sm = new SavingsManager();
  });

  it("deposits positive amount and locks it", () => {
    const dep = sm.deposit(100, "exec-1");
    expect(dep.amount).toBe(100);
    expect(dep.executionId).toBe("exec-1");
    expect(dep.depositId).toBeTruthy();
    expect(dep.depositedAt).toBeTruthy();

    const state = sm.getState();
    expect(state.totalLocked).toBe(100);
    expect(state.depositCount).toBe(1);
    expect(state.lastDepositAt).toBe(dep.depositedAt);
  });

  it("accumulates multiple deposits", () => {
    sm.deposit(100, "exec-1");
    sm.deposit(250, "exec-2");
    sm.deposit(50, "exec-3");

    const state = sm.getState();
    expect(state.totalLocked).toBe(400);
    expect(state.depositCount).toBe(3);
  });

  it("throws on zero amount", () => {
    expect(() => sm.deposit(0, "exec-1")).toThrow("Invalid deposit amount");
  });

  it("throws on negative amount", () => {
    expect(() => sm.deposit(-50, "exec-1")).toThrow("Invalid deposit amount");
  });

  it("generates unique deposit IDs", () => {
    const d1 = sm.deposit(10, "exec-1");
    const d2 = sm.deposit(10, "exec-2");
    expect(d1.depositId).not.toBe(d2.depositId);
  });

  it("handles very small fractional amounts", () => {
    sm.deposit(0.01, "exec-1");
    expect(sm.getState().totalLocked).toBeCloseTo(0.01);
  });
});

describe("SavingsManager — state persistence", () => {
  it("getState returns a copy", () => {
    const sm = new SavingsManager({ totalLocked: 500, depositCount: 3 });
    const s = sm.getState();
    s.totalLocked = 0;
    expect(sm.getState().totalLocked).toBe(500);
  });

  it("loadState replaces internal state", () => {
    const sm = new SavingsManager();
    sm.loadState({ totalLocked: 1000, depositCount: 5, lastDepositAt: "2026-01-01T00:00:00.000Z" });
    const state = sm.getState();
    expect(state.totalLocked).toBe(1000);
    expect(state.depositCount).toBe(5);
    expect(state.lastDepositAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("initialises with partial state", () => {
    const sm = new SavingsManager({ totalLocked: 200 });
    const state = sm.getState();
    expect(state.totalLocked).toBe(200);
    expect(state.depositCount).toBe(0);
    expect(state.lastDepositAt).toBeUndefined();
  });
});
