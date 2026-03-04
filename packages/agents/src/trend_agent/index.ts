// ============================================================================
// Trend Agent — Trend-following signal agent
// ============================================================================
// Strategy: Moving average crossovers, ADX trend strength, breakout detection
// Alpha source: Sustained directional moves in trending markets

import type { AgentSignal, AgentMeta } from "@trading-pod/shared";
import { generateId, now } from "@trading-pod/shared";
import type { SignalAgent, MarketDataSnapshot } from "../shared_agent_protocols.js";

export class TrendAgent implements SignalAgent {
  getMeta(): AgentMeta {
    return {
      agentId: "trend_agent",
      name: "Trend Agent",
      description:
        "Trend-following agent using moving average crossovers, ADX, and breakout detection",
      assetClasses: ["fx", "crypto"],
      version: "0.1.0",
      enabled: true,
    };
  }

  analyze(data: MarketDataSnapshot): AgentSignal | null {
    // TODO: Implement trend-following logic
    // - Calculate fast/slow moving averages from priceHistory
    // - Compute ADX for trend strength
    // - Detect breakouts above/below recent range
    // - Only emit signal when trend is confirmed (ADX > threshold)

    if (data.priceHistory.length < 50) {
      return null; // Not enough data
    }

    // Placeholder: simple MA crossover check
    const fastPeriod = 10;
    const slowPeriod = 30;

    const fastMA = average(data.priceHistory.slice(0, fastPeriod));
    const slowMA = average(data.priceHistory.slice(0, slowPeriod));

    if (Math.abs(fastMA - slowMA) / slowMA < 0.001) {
      return null; // No clear trend
    }

    const direction = fastMA > slowMA ? "long" : "short";
    const trendStrength = Math.min(
      Math.abs(fastMA - slowMA) / slowMA * 10,
      1.0
    );

    const atr = computeATR(data.priceHistory, 14);
    const stopLoss =
      direction === "long"
        ? data.currentPrice - atr * 2
        : data.currentPrice + atr * 2;
    const takeProfit =
      direction === "long"
        ? data.currentPrice + atr * 3
        : data.currentPrice - atr * 3;

    return {
      signalId: generateId(),
      agentId: this.getMeta().agentId,
      source: "internal",
      assetClass: data.assetClass,
      instrument: data.instrument,
      direction,
      confidence: trendStrength,
      stopLoss,
      takeProfit,
      holdingTimeMinutes: 240,
      justification: `Trend detected: fast MA (${fastPeriod}) ${direction === "long" ? "above" : "below"} slow MA (${slowPeriod}). Strength: ${(trendStrength * 100).toFixed(1)}%`,
      currentPrice: data.currentPrice,
      timestamp: now(),
    };
  }
}

function average(prices: number[]): number {
  if (prices.length === 0) return 0;
  return prices.reduce((sum, p) => sum + p, 0) / prices.length;
}

function computeATR(prices: number[], period: number): number {
  if (prices.length < period + 1) return prices[0] * 0.01; // fallback 1%
  const ranges: number[] = [];
  for (let i = 0; i < period; i++) {
    ranges.push(Math.abs(prices[i] - prices[i + 1]));
  }
  return average(ranges);
}

export function createTrendAgent(): TrendAgent {
  return new TrendAgent();
}
