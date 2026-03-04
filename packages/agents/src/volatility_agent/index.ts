// ============================================================================
// Volatility Agent — Volatility-based signal agent
// ============================================================================
// Strategy: ATR breakouts, volatility compression/expansion, Keltner channels
// Alpha source: Explosive moves following low-volatility compression periods

import type { AgentSignal, AgentMeta } from "@trading-pod/shared";
import { generateId, now } from "@trading-pod/shared";
import type { SignalAgent, MarketDataSnapshot } from "../shared_agent_protocols.js";

export class VolatilityAgent implements SignalAgent {
  getMeta(): AgentMeta {
    return {
      agentId: "volatility_agent",
      name: "Volatility Agent",
      description:
        "Volatility-based agent detecting compression/expansion cycles and ATR breakouts",
      assetClasses: ["fx", "crypto"],
      version: "0.1.0",
      enabled: true,
    };
  }

  analyze(data: MarketDataSnapshot): AgentSignal | null {
    // TODO: Implement volatility-based logic
    // - Calculate ATR over 14 and 50 periods
    // - Detect volatility compression (ATR14 << ATR50)
    // - On compression breakout, signal in breakout direction
    // - Use Keltner channels for directional bias

    if (data.priceHistory.length < 50) {
      return null;
    }

    const atr14 = computeATR(data.priceHistory, 14);
    const atr50 = computeATR(data.priceHistory, 50);

    if (atr50 === 0) return null;

    const volRatio = atr14 / atr50;

    // Compression detection: current vol < 60% of historical vol
    // indicates a squeeze that may resolve with an explosive move
    if (volRatio > 0.6) {
      return null; // No compression detected
    }

    // Determine breakout direction from recent price action
    const recentHigh = Math.max(...data.priceHistory.slice(0, 5));
    const recentLow = Math.min(...data.priceHistory.slice(0, 5));
    const midpoint = (recentHigh + recentLow) / 2;

    const direction = data.currentPrice > midpoint ? "long" : "short";
    const confidence = Math.min((1 - volRatio) * 1.5, 1.0);

    const stopLoss =
      direction === "long"
        ? data.currentPrice - atr50 * 1.5
        : data.currentPrice + atr50 * 1.5;
    const takeProfit =
      direction === "long"
        ? data.currentPrice + atr50 * 3
        : data.currentPrice - atr50 * 3;

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
      holdingTimeMinutes: 180,
      justification: `Volatility compression detected: ATR ratio ${volRatio.toFixed(2)} (14/50). Expecting expansion breakout ${direction}.`,
      currentPrice: data.currentPrice,
      timestamp: now(),
    };
  }
}

function computeATR(prices: number[], period: number): number {
  if (prices.length < period + 1) return prices[0] * 0.01;
  const ranges: number[] = [];
  for (let i = 0; i < period; i++) {
    ranges.push(Math.abs(prices[i] - prices[i + 1]));
  }
  return ranges.reduce((s, r) => s + r, 0) / ranges.length;
}

export function createVolatilityAgent(): VolatilityAgent {
  return new VolatilityAgent();
}
