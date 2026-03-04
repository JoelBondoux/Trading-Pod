// ============================================================================
// Context Provider Types — Market state and news filter
// ============================================================================

/** Market regime classification */
export type MarketRegime = "trending" | "ranging" | "volatile";

/** Output from the Market State context provider */
export interface MarketStateOutput {
  /** Current classified regime */
  regime: MarketRegime;

  /** Confidence in the classification (0–1) */
  confidence: number;

  /** Current ATR (average true range) as percentage */
  atrPercent: number;

  /** Instrument this applies to */
  instrument: string;

  /** ISO 8601 timestamp */
  timestamp: string;
}

/** Output from the News Filter context provider */
export interface NewsFilterOutput {
  /** Whether trading should be blocked due to news */
  block: boolean;

  /** Reason for the block */
  reason?: string;

  /** Time until the news window ends (minutes) */
  blockRemainingMinutes?: number;

  /** ISO 8601 timestamp */
  timestamp: string;
}
