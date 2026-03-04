// ============================================================================
// Momentum Agent — Momentum / rate-of-change signal agent
// ============================================================================
// Strategy: Rate of change, relative strength, momentum factor scoring
// Alpha source: Assets with strong recent performance continuing to outperform

import type { AgentSignal, AgentMeta } from "@trading-pod/shared";
import { generateId, now } from "@trading-pod/shared";
import type { SignalAgent, MarketDataSnapshot } from "../shared_agent_protocols.js";

export class MomentumAgent implements SignalAgent {
  getMeta(): AgentMeta {
    return {
      agentId: "momentum_agent",
      name: "Momentum Agent",
      description:
        "Momentum agent using rate of change, relative strength, and breakout velocity",
      assetClasses: ["fx", "crypto"],
      version: "0.1.0",
      enabled: true,
    };
  }

  analyze(data: MarketDataSnapshot): AgentSignal | null {
    // TODO: Implement momentum / rate-of-change logic
    // - Calculate ROC over multiple lookback periods (5, 10, 20)
    // - Compute momentum score as weighted sum of ROCs
    // - Assess velocity (acceleration of momentum)
    // - Signal when momentum is strong and accelerating

    if (data.priceHistory.length < 30) {
      return null;
    }

    // Rate of change over multiple periods
    const roc5 = rateOfChange(data.priceHistory, 5);
    const roc10 = rateOfChange(data.priceHistory, 10);
    const roc20 = rateOfChange(data.priceHistory, 20);

    // Composite momentum score (weighted, more recent = higher weight)
    const momentumScore = roc5 * 0.5 + roc10 * 0.3 + roc20 * 0.2;

    // Threshold: need clear momentum (at least 0.5% composite move)
    if (Math.abs(momentumScore) < 0.005) {
      return null;
    }

    // Acceleration check: is momentum increasing?
    const prevRoc5 = rateOfChange(data.priceHistory.slice(1), 5);
    const acceleration = roc5 - prevRoc5;

    // Only signal if momentum and acceleration align
    if (momentumScore > 0 && acceleration < 0) return null;
    if (momentumScore < 0 && acceleration > 0) return null;

    const direction = momentumScore > 0 ? "long" : "short";
    const confidence = Math.min(Math.abs(momentumScore) * 20, 1.0);

    const atr = computeATR(data.priceHistory, 14);
    const stopLoss =
      direction === "long"
        ? data.currentPrice - atr * 2
        : data.currentPrice + atr * 2;
    const takeProfit =
      direction === "long"
        ? data.currentPrice + atr * 4
        : data.currentPrice - atr * 4;

    return {
      signalId: generateId(),
      agentId: this.getMeta().agentId,
      source: "internal",
      assetClass: data.assetClass,
      instrument: data.instrument,
      direction,
      confidence,
      stopLoss,
      takeProfit,
      holdingTimeMinutes: 360,
      justification: `Momentum ${direction}: ROC5=${(roc5 * 100).toFixed(2)}%, ROC10=${(roc10 * 100).toFixed(2)}%, composite=${(momentumScore * 100).toFixed(2)}%, acceleration=${acceleration > 0 ? "positive" : "negative"}`,
      currentPrice: data.currentPrice,
      timestamp: now(),
    };
  }
}

function rateOfChange(prices: number[], period: number): number {
  if (prices.length <= period) return 0;
  const current = prices[0];
  const past = prices[period];
  if (past === 0) return 0;
  return (current - past) / past;
}

function computeATR(prices: number[], period: number): number {
  if (prices.length < period + 1) return prices[0] * 0.01;
  const ranges: number[] = [];
  for (let i = 0; i < period; i++) {
    ranges.push(Math.abs(prices[i] - prices[i + 1]));
  }
  return ranges.reduce((s, r) => s + r, 0) / ranges.length;
}

export function createMomentumAgent(): MomentumAgent {
  return new MomentumAgent();
}
