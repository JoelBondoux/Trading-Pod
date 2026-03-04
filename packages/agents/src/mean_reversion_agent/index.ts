// ============================================================================
// Mean Reversion Agent — Mean-reversion signal agent
// ============================================================================
// Strategy: Bollinger Bands, RSI extremes, Z-score of price vs moving average
// Alpha source: Price snap-back from overextended moves

import type { AgentSignal, AgentMeta } from "@trading-pod/shared";
import { generateId, now } from "@trading-pod/shared";
import type { SignalAgent, MarketDataSnapshot } from "../shared_agent_protocols.js";

export class MeanReversionAgent implements SignalAgent {
  getMeta(): AgentMeta {
    return {
      agentId: "mean_reversion_agent",
      name: "Mean Reversion Agent",
      description:
        "Mean-reversion agent using Bollinger Bands, RSI extremes, and Z-score analysis",
      assetClasses: ["fx", "crypto"],
      version: "0.1.0",
      enabled: true,
    };
  }

  analyze(data: MarketDataSnapshot): AgentSignal | null {
    // TODO: Implement mean reversion logic
    // - Calculate Bollinger Bands (20-period SMA ± 2 std devs)
    // - Compute RSI (14-period)
    // - Calculate Z-score of current price vs moving average
    // - Signal when price is at band extremes with confirming RSI

    if (data.priceHistory.length < 30) {
      return null;
    }

    const period = 20;
    const prices = data.priceHistory.slice(0, period);
    const ma = average(prices);
    const stdDev = standardDeviation(prices, ma);

    if (stdDev === 0) return null;

    const zScore = (data.currentPrice - ma) / stdDev;

    // Only signal at Z-score extremes (> 2 or < -2)
    if (Math.abs(zScore) < 2.0) {
      return null;
    }

    // Mean reversion: go opposite to the extreme
    const direction = zScore > 0 ? "short" : "long";
    const confidence = Math.min(Math.abs(zScore) / 4, 1.0);

    const atr = computeSimpleATR(data.priceHistory, 14);
    const stopLoss =
      direction === "long"
        ? data.currentPrice - atr * 1.5
        : data.currentPrice + atr * 1.5;
    const takeProfit =
      direction === "long"
        ? ma // Target the mean
        : ma;

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
      holdingTimeMinutes: 120,
      justification: `Mean reversion signal: Z-score ${zScore.toFixed(2)}, price ${zScore > 0 ? "above" : "below"} ${period}-period MA by ${Math.abs(zScore).toFixed(1)} std devs`,
      currentPrice: data.currentPrice,
      timestamp: now(),
    };
  }
}

function average(prices: number[]): number {
  if (prices.length === 0) return 0;
  return prices.reduce((sum, p) => sum + p, 0) / prices.length;
}

function standardDeviation(prices: number[], mean: number): number {
  if (prices.length < 2) return 0;
  const variance =
    prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) /
    (prices.length - 1);
  return Math.sqrt(variance);
}

function computeSimpleATR(prices: number[], period: number): number {
  if (prices.length < period + 1) return prices[0] * 0.01;
  const ranges: number[] = [];
  for (let i = 0; i < period; i++) {
    ranges.push(Math.abs(prices[i] - prices[i + 1]));
  }
  return average(ranges);
}

export function createMeanReversionAgent(): MeanReversionAgent {
  return new MeanReversionAgent();
}
