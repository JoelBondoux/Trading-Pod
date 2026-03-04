// ============================================================================
// Financial Controller Types — FC decision pipeline
// ============================================================================

import type { AgentSignal, Direction } from "./agent.js";

/** Individual risk check result */
export interface RiskCheck {
  rule: string;
  passed: boolean;
  reason?: string;
}

/** Weighted consensus computed from agent signals */
export interface WeightedConsensus {
  direction: Direction;
  confidence: number;
  signalCount: number;
  weightedScore: number;
}

/** Full FC decision output */
export interface FCDecision {
  /** Unique decision identifier */
  decisionId: string;

  /** Weighted consensus from signal agents */
  consensus: WeightedConsensus;

  /** Results of each risk check */
  riskChecks: RiskCheck[];

  /** Whether all risk checks passed */
  allRiskChecksPassed: boolean;

  /** Capital amount requested from Treasurer */
  capitalRequested: number;

  /** Whether the Treasurer approved the capital request */
  capitalApproved: boolean;

  /** Final go/no-go decision */
  approved: boolean;

  /** Reason for rejection (if not approved) */
  rejectionReason?: string;

  /** Signals that contributed to this decision */
  contributingSignals: AgentSignal[];

  /** ISO 8601 timestamp */
  timestamp: string;
}

/** Risk rule configuration */
export interface RiskRuleConfig {
  /** Minimum reward-to-risk ratio */
  minRewardRiskRatio: number;

  /** Maximum stop-loss distance as percentage of price */
  maxStopLossPercent: number;

  /** Minimum stop-loss distance as percentage of price */
  minStopLossPercent: number;

  /** Maximum trades per day */
  maxTradesPerDay: number;

  /** Minimum aggregated confidence to proceed */
  minConfidence: number;

  /** Blocked volatility regimes */
  blockedRegimes: string[];

  /** News window block duration in minutes */
  newsBlockWindowMinutes: number;
}

/** Default risk rule configuration */
export const DEFAULT_RISK_RULES: RiskRuleConfig = {
  minRewardRiskRatio: 1.5,
  maxStopLossPercent: 3.0,
  minStopLossPercent: 0.1,
  maxTradesPerDay: 5,
  minConfidence: 0.6,
  blockedRegimes: ["volatile"],
  newsBlockWindowMinutes: 30,
};
