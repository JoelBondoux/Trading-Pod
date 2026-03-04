// ============================================================================
// Credibility Types — Agent credibility scoring
// ============================================================================

/** Credibility record for a single agent */
export interface CredibilityRecord {
  /** Agent identifier */
  agentId: string;

  /** Current credibility score (0–1) */
  score: number;

  /** Total number of scored trades */
  tradeCount: number;

  /** Number of correct (profitable) signals */
  correctCount: number;

  /** ISO 8601 timestamp of last credibility update */
  lastUpdated: string;
}

/** Parameters governing credibility updates */
export interface CredibilityParams {
  /** EMA smoothing factor (0.05–0.20, default 0.1) */
  alpha: number;

  /** Idle decay factor per day (0.995–0.999, default 0.997) */
  idleDecayLambda: number;

  /** Initial credibility score for new agents */
  initialScore: number;

  /** Minimum credibility score (floor) */
  minScore: number;
}

/** Default credibility parameters */
export const DEFAULT_CREDIBILITY_PARAMS: CredibilityParams = {
  alpha: 0.1,
  idleDecayLambda: 0.997,
  initialScore: 0.5,
  minScore: 0.05,
};
