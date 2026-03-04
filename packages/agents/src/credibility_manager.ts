// ============================================================================
// Credibility Manager — EMA-based credibility scoring with idle decay
// ============================================================================

import {
  clamp,
  DEFAULT_CREDIBILITY_PARAMS,
  type CredibilityParams,
  type CredibilityRecord,
  now,
} from "@trading-pod/shared";

/**
 * Update an agent's credibility score using Exponential Moving Average.
 *
 * Formula: C_new = α × outcome + (1 − α) × C_current
 *
 * @param current - Current credibility score (0–1)
 * @param outcome - Trade outcome: 1 if profitable/correct, 0 if not
 * @param alpha - EMA smoothing factor (default 0.1)
 * @returns Updated credibility score clamped to [minScore, 1]
 */
export function updateCredibility(
  current: number,
  outcome: 0 | 1,
  alpha: number = DEFAULT_CREDIBILITY_PARAMS.alpha,
  minScore: number = DEFAULT_CREDIBILITY_PARAMS.minScore
): number {
  const updated = alpha * outcome + (1 - alpha) * current;
  return clamp(updated, minScore, 1.0);
}

/**
 * Apply idle decay to a credibility score.
 * Prevents stale agents from retaining artifically high scores.
 *
 * Formula: C_decayed = C_current × λ^Δt
 *
 * @param current - Current credibility score
 * @param intervalsSinceLastSignal - Number of time intervals (days) since last signal
 * @param lambda - Decay factor per interval (default 0.997)
 * @returns Decayed credibility score
 */
export function applyIdleDecay(
  current: number,
  intervalsSinceLastSignal: number,
  lambda: number = DEFAULT_CREDIBILITY_PARAMS.idleDecayLambda,
  minScore: number = DEFAULT_CREDIBILITY_PARAMS.minScore
): number {
  if (intervalsSinceLastSignal <= 0) return current;
  const decayed = current * Math.pow(lambda, intervalsSinceLastSignal);
  return clamp(decayed, minScore, 1.0);
}

/**
 * Compute weighted consensus from multiple agent signals.
 * Weights are proportional to each agent's credibility score.
 *
 * @param signals - Array of (agentId, direction, confidence) tuples
 * @param credibilities - Map of agentId → credibility score
 * @returns Weighted consensus direction and confidence
 */
export function computeWeightedConsensus(
  signals: Array<{
    agentId: string;
    direction: "long" | "short";
    confidence: number;
  }>,
  credibilities: Map<string, number>
): { direction: "long" | "short"; confidence: number; weightedScore: number } {
  if (signals.length === 0) {
    return { direction: "long", confidence: 0, weightedScore: 0 };
  }

  let longScore = 0;
  let shortScore = 0;
  let totalWeight = 0;

  for (const signal of signals) {
    const credibility = credibilities.get(signal.agentId) ?? DEFAULT_CREDIBILITY_PARAMS.initialScore;
    const weight = credibility * signal.confidence;
    totalWeight += credibility;

    if (signal.direction === "long") {
      longScore += weight;
    } else {
      shortScore += weight;
    }
  }

  const direction = longScore >= shortScore ? "long" as const : "short" as const;
  const winningScore = Math.max(longScore, shortScore);
  const confidence = totalWeight > 0 ? winningScore / totalWeight : 0;

  return {
    direction,
    confidence: clamp(confidence, 0, 1),
    weightedScore: winningScore,
  };
}

/**
 * Create a new credibility record for a freshly registered agent.
 */
export function createInitialCredibility(
  agentId: string,
  params: CredibilityParams = DEFAULT_CREDIBILITY_PARAMS
): CredibilityRecord {
  return {
    agentId,
    score: params.initialScore,
    tradeCount: 0,
    correctCount: 0,
    lastUpdated: now(),
  };
}

/**
 * Process a trade outcome and return the updated credibility record.
 */
export function processTradeOutcome(
  record: CredibilityRecord,
  profitable: boolean,
  params: CredibilityParams = DEFAULT_CREDIBILITY_PARAMS
): CredibilityRecord {
  const outcome: 0 | 1 = profitable ? 1 : 0;
  const newScore = updateCredibility(record.score, outcome, params.alpha, params.minScore);

  return {
    ...record,
    score: newScore,
    tradeCount: record.tradeCount + 1,
    correctCount: record.correctCount + (profitable ? 1 : 0),
    lastUpdated: now(),
  };
}
