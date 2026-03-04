// ============================================================================
// Credibility Manager Tests — EMA scoring + idle decay + consensus
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  updateCredibility,
  applyIdleDecay,
  computeWeightedConsensus,
  createInitialCredibility,
  processTradeOutcome,
} from "../src/credibility_manager.js";

// ---------------------------------------------------------------------------
// updateCredibility
// ---------------------------------------------------------------------------

describe("updateCredibility", () => {
  it("increases score on profitable outcome", () => {
    const result = updateCredibility(0.5, 1, 0.1);
    // 0.1 × 1 + 0.9 × 0.5 = 0.55
    expect(result).toBeCloseTo(0.55);
  });

  it("decreases score on losing outcome", () => {
    const result = updateCredibility(0.5, 0, 0.1);
    // 0.1 × 0 + 0.9 × 0.5 = 0.45
    expect(result).toBeCloseTo(0.45);
  });

  it("never drops below minScore", () => {
    // Repeated losses should floor at minScore
    let score = 0.1;
    for (let i = 0; i < 200; i++) {
      score = updateCredibility(score, 0, 0.1, 0.05);
    }
    expect(score).toBeCloseTo(0.05);
  });

  it("reaches 1.0 with repeated wins", () => {
    let score = 0.5;
    for (let i = 0; i < 200; i++) {
      score = updateCredibility(score, 1, 0.1, 0.05);
    }
    expect(score).toBeCloseTo(1.0, 4);
  });

  it("respects custom alpha", () => {
    const fast = updateCredibility(0.5, 1, 0.3); // faster adaptation
    const slow = updateCredibility(0.5, 1, 0.05); // slower adaptation
    expect(fast).toBeGreaterThan(slow);
  });
});

// ---------------------------------------------------------------------------
// applyIdleDecay
// ---------------------------------------------------------------------------

describe("applyIdleDecay", () => {
  it("returns same score for 0 intervals", () => {
    expect(applyIdleDecay(0.8, 0)).toBe(0.8);
  });

  it("returns same score for negative intervals", () => {
    expect(applyIdleDecay(0.8, -5)).toBe(0.8);
  });

  it("decays score after 1 day", () => {
    const decayed = applyIdleDecay(0.8, 1, 0.997);
    // 0.8 × 0.997 = 0.7976
    expect(decayed).toBeCloseTo(0.7976);
  });

  it("decays significantly after 30 days", () => {
    const decayed = applyIdleDecay(0.8, 30, 0.997);
    // 0.8 × 0.997^30 ≈ 0.8 × 0.9139 ≈ 0.731
    expect(decayed).toBeLessThan(0.8);
    expect(decayed).toBeGreaterThan(0.7);
  });

  it("floors at minScore after extreme idle", () => {
    const decayed = applyIdleDecay(0.8, 10000, 0.997, 0.05);
    expect(decayed).toBeCloseTo(0.05);
  });
});

// ---------------------------------------------------------------------------
// computeWeightedConsensus
// ---------------------------------------------------------------------------

describe("computeWeightedConsensus", () => {
  it("returns zero confidence for empty signals", () => {
    const result = computeWeightedConsensus([], new Map());
    expect(result.confidence).toBe(0);
    expect(result.weightedScore).toBe(0);
  });

  it("follows single agent direction", () => {
    const signals = [{ agentId: "a1", direction: "short" as const, confidence: 0.9 }];
    const creds = new Map([["a1", 0.8]]);
    const result = computeWeightedConsensus(signals, creds);
    expect(result.direction).toBe("short");
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("majority wins with equal credibility", () => {
    const signals = [
      { agentId: "a1", direction: "long" as const, confidence: 0.8 },
      { agentId: "a2", direction: "long" as const, confidence: 0.7 },
      { agentId: "a3", direction: "short" as const, confidence: 0.9 },
    ];
    const creds = new Map([["a1", 0.5], ["a2", 0.5], ["a3", 0.5]]);
    const result = computeWeightedConsensus(signals, creds);
    expect(result.direction).toBe("long"); // 2 vs 1
  });

  it("high-credibility agent can override majority", () => {
    const signals = [
      { agentId: "a1", direction: "long" as const, confidence: 0.5 },
      { agentId: "a2", direction: "long" as const, confidence: 0.5 },
      { agentId: "expert", direction: "short" as const, confidence: 0.95 },
    ];
    // Expert has much higher credibility
    const creds = new Map([["a1", 0.1], ["a2", 0.1], ["expert", 1.0]]);
    const result = computeWeightedConsensus(signals, creds);
    // Short score: 1.0 × 0.95 = 0.95, Long score: 0.1×0.5 + 0.1×0.5 = 0.10
    expect(result.direction).toBe("short");
  });

  it("uses default credibility when agent not in map", () => {
    const signals = [{ agentId: "unknown", direction: "long" as const, confidence: 0.8 }];
    const result = computeWeightedConsensus(signals, new Map());
    // Should use initialScore (0.5) as default
    expect(result.confidence).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// createInitialCredibility
// ---------------------------------------------------------------------------

describe("createInitialCredibility", () => {
  it("creates record with default initial score", () => {
    const rec = createInitialCredibility("test_agent");
    expect(rec.agentId).toBe("test_agent");
    expect(rec.score).toBe(0.5);
    expect(rec.tradeCount).toBe(0);
    expect(rec.correctCount).toBe(0);
    expect(rec.lastUpdated).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// processTradeOutcome
// ---------------------------------------------------------------------------

describe("processTradeOutcome", () => {
  it("increases score and counts on win", () => {
    const initial = createInitialCredibility("a1");
    const updated = processTradeOutcome(initial, true);
    expect(updated.score).toBeGreaterThan(initial.score);
    expect(updated.tradeCount).toBe(1);
    expect(updated.correctCount).toBe(1);
  });

  it("decreases score on loss", () => {
    const initial = createInitialCredibility("a1");
    const updated = processTradeOutcome(initial, false);
    expect(updated.score).toBeLessThan(initial.score);
    expect(updated.tradeCount).toBe(1);
    expect(updated.correctCount).toBe(0);
  });

  it("tracks cumulative stats correctly over series", () => {
    let rec = createInitialCredibility("a1");
    // Win, Win, Lose, Win, Lose
    const outcomes = [true, true, false, true, false];
    for (const outcome of outcomes) {
      rec = processTradeOutcome(rec, outcome);
    }
    expect(rec.tradeCount).toBe(5);
    expect(rec.correctCount).toBe(3);
  });
});
