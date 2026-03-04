// ============================================================================
// Agent Types — Signal agent message contracts
// ============================================================================

/** Asset classes supported by the system */
export type AssetClass = "fx" | "crypto";

/** Trade direction */
export type Direction = "long" | "short";

/** Signal emitted by a signal agent */
export interface AgentSignal {
  /** Unique signal identifier */
  signalId: string;

  /** Agent that produced this signal */
  agentId: string;

  /** Source of the signal */
  source: "internal" | "tradingview";

  /** Asset class this signal targets */
  assetClass: AssetClass;

  /** Trading pair / instrument (e.g., "GBP/USD", "BTC/USD") */
  instrument: string;

  /** Proposed trade direction */
  direction: Direction;

  /** Confidence level 0–1 */
  confidence: number;

  /** Stop-loss price */
  stopLoss: number;

  /** Take-profit price */
  takeProfit: number;

  /** Suggested holding time in minutes */
  holdingTimeMinutes: number;

  /** Human-readable justification */
  justification: string;

  /** Current market price at time of signal */
  currentPrice: number;

  /** ISO 8601 timestamp */
  timestamp: string;
}

/** Agent registration metadata */
export interface AgentMeta {
  agentId: string;
  name: string;
  description: string;
  assetClasses: AssetClass[];
  version: string;
  enabled: boolean;
}
