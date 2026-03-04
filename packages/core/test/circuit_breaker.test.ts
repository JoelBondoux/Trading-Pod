// ============================================================================
// Circuit Breaker Tests
// ============================================================================

import { describe, it, expect, beforeEach } from "vitest";
import {
  CircuitBreaker,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from "../src/circuit_breaker/circuit_breaker.js";

describe("CircuitBreaker — consecutive losses", () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker(10_000, {
      maxConsecutiveLosses: 3,
      maxDailyDrawdownPercent: 0.05,
      cooldownMinutes: 0,
    });
  });

  it("allows trading initially", () => {
    expect(cb.canTrade().allowed).toBe(true);
  });

  it("allows after 2 consecutive losses (below threshold)", () => {
    cb.recordOutcome(-50);
    cb.recordOutcome(-50);
    expect(cb.canTrade().allowed).toBe(true);
  });

  it("trips after 3 consecutive losses", () => {
    cb.recordOutcome(-50);
    cb.recordOutcome(-50);
    cb.recordOutcome(-50);
    const result = cb.canTrade();
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("3 consecutive losses");
  });

  it("resets consecutive count on a win", () => {
    cb.recordOutcome(-50);
    cb.recordOutcome(-50);
    cb.recordOutcome(10); // win resets streak
    cb.recordOutcome(-50);
    cb.recordOutcome(-50);
    expect(cb.canTrade().allowed).toBe(true); // only 2 consecutive
  });

  it("manual reset clears trip", () => {
    cb.recordOutcome(-50);
    cb.recordOutcome(-50);
    cb.recordOutcome(-50);
    expect(cb.canTrade().allowed).toBe(false);
    cb.reset();
    expect(cb.canTrade().allowed).toBe(true);
  });
});

describe("CircuitBreaker — daily drawdown", () => {
  it("trips when drawdown exceeds 5% of base capital", () => {
    const cb = new CircuitBreaker(10_000, {
      maxConsecutiveLosses: 100, // high so we only test drawdown
      maxDailyDrawdownPercent: 0.05,
      cooldownMinutes: 0,
    });

    // Lose £500 total = 5% of £10,000
    cb.recordOutcome(-200);
    cb.recordOutcome(-200);
    expect(cb.canTrade().allowed).toBe(true); // 400 = 4%
    cb.recordOutcome(-100); // 500 = 5%
    expect(cb.canTrade().allowed).toBe(false);
    expect(cb.canTrade().reason).toContain("drawdown");
  });
});

describe("CircuitBreaker — cooldown auto-resume", () => {
  it("auto-resumes after cooldown", () => {
    const cb = new CircuitBreaker(10_000, {
      maxConsecutiveLosses: 1,
      maxDailyDrawdownPercent: 1.0,
      cooldownMinutes: 1, // 1 minute cooldown
    });

    cb.recordOutcome(-50);
    expect(cb.canTrade().allowed).toBe(false);

    // Manually set trippedAt to 2 minutes ago
    const state = cb.getState();
    state.trippedAt = new Date(Date.now() - 2 * 60_000).toISOString();
    cb.loadState(state);

    expect(cb.canTrade().allowed).toBe(true);
  });
});

describe("CircuitBreaker — state persistence", () => {
  it("getState returns a copy", () => {
    const cb = new CircuitBreaker(10_000);
    const s = cb.getState();
    s.tripped = true;
    expect(cb.getState().tripped).toBe(false);
  });

  it("loadState restores state", () => {
    const cb = new CircuitBreaker(10_000);
    cb.recordOutcome(-50);
    const snapshot = cb.getState();
    expect(snapshot.consecutiveLosses).toBe(1);

    const cb2 = new CircuitBreaker(10_000);
    cb2.loadState(snapshot);
    expect(cb2.getState().consecutiveLosses).toBe(1);
  });
});

describe("CircuitBreaker defaults", () => {
  it("has sensible defaults", () => {
    expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.maxConsecutiveLosses).toBe(3);
    expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.maxDailyDrawdownPercent).toBe(0.05);
    expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.cooldownMinutes).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("CircuitBreaker — edge cases", () => {
  it("treats pnl=0 as a non-loss (resets consecutive counter)", () => {
    const cb = new CircuitBreaker(10_000, {
      maxConsecutiveLosses: 3,
      maxDailyDrawdownPercent: 1.0,
      cooldownMinutes: 0,
    });

    cb.recordOutcome(-10);
    cb.recordOutcome(-10);
    cb.recordOutcome(0); // pnl=0 is >= 0, resets streak

    expect(cb.canTrade().allowed).toBe(true);
    expect(cb.getState().consecutiveLosses).toBe(0);
  });

  it("exactly-at-boundary drawdown trips circuit breaker (>= check)", () => {
    const cb = new CircuitBreaker(10_000, {
      maxConsecutiveLosses: 100,
      maxDailyDrawdownPercent: 0.05,
      cooldownMinutes: 0,
    });

    // 499 < 500 → still allowed
    cb.recordOutcome(-499);
    expect(cb.canTrade().allowed).toBe(true);

    // 499 + 1 = 500 = exactly 5% → trips
    cb.recordOutcome(-1);
    expect(cb.canTrade().allowed).toBe(false);
  });
});
