// ============================================================================
// Signal Agent Protocol — Base interface all signal agents must implement
// ============================================================================

import type { AgentSignal, AgentMeta, AssetClass } from "@trading-pod/shared";

/** Market data snapshot provided to agents for analysis */
export interface MarketDataSnapshot {
  instrument: string;
  assetClass: AssetClass;
  currentPrice: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** Recent price history (most recent first) */
  priceHistory: number[];
  /** Timeframe of the candles in minutes */
  timeframeMinutes: number;
  timestamp: string;
}

/**
 * Base interface for all signal agents.
 *
 * Each agent:
 * - Runs independently
 * - Cannot access capital, risk parameters, or other agents
 * - Emits a typed AgentSignal with direction, confidence, SL/TP
 * - Has a credibility score managed externally
 */
export interface SignalAgent {
  /** Get agent metadata */
  getMeta(): AgentMeta;

  /**
   * Analyze market data and optionally produce a signal.
   * Returns null if no actionable signal is found.
   */
  analyze(data: MarketDataSnapshot): AgentSignal | null;
}

/**
 * Factory function type for creating signal agents.
 * Agents are instantiated via factory to allow dependency injection.
 */
export type SignalAgentFactory = () => SignalAgent;
