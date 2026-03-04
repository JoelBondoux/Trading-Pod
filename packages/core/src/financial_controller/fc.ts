// ============================================================================
// Financial Controller — Aggregates signals, applies risk rules, decides
// ============================================================================

import type {
  AgentSignal,
  FCDecision,
  RiskRuleConfig,
  CapitalResponse,
  MarketStateOutput,
  NewsFilterOutput,
  WeightedConsensus,
} from "@trading-pod/shared";
import { generateId, now, DEFAULT_RISK_RULES } from "@trading-pod/shared";
import { computeWeightedConsensus } from "@trading-pod/agents";
import { runAllRiskChecks } from "../risk_rules/rules.js";

export interface FCDependencies {
  /** Fetch credibilities for all active agents */
  getCredibilities: () => Promise<Map<string, number>>;

  /** Request capital from the Treasurer */
  requestCapital: (decisionId: string, amount: number, assetClass: "fx" | "crypto", instrument: string) => Promise<CapitalResponse>;

  /** Get current daily trade count */
  getDailyTradeCount: () => Promise<number>;

  /** Get current market state (from context provider) */
  getMarketState: (instrument: string) => Promise<MarketStateOutput | null>;

  /** Get news filter output (from context provider) */
  getNewsFilter: () => Promise<NewsFilterOutput | null>;

  /** Emit a system event */
  emitEvent: (event: unknown) => Promise<void>;
}

export class FinancialController {
  private config: RiskRuleConfig;
  private deps: FCDependencies;

  constructor(deps: FCDependencies, config: RiskRuleConfig = DEFAULT_RISK_RULES) {
    this.config = config;
    this.deps = deps;
  }

  /**
   * Process a batch of incoming agent signals and produce an FC decision.
   */
  async decide(signals: AgentSignal[]): Promise<FCDecision> {
    const decisionId = generateId();

    if (signals.length === 0) {
      return this.rejectDecision(decisionId, signals, "No signals received");
    }

    // 1. Compute weighted consensus
    const credibilities = await this.deps.getCredibilities();
    const consensusInput = signals.map((s) => ({
      agentId: s.agentId,
      direction: s.direction,
      confidence: s.confidence,
    }));
    const consensusResult = computeWeightedConsensus(consensusInput, credibilities);

    const consensus: WeightedConsensus = {
      direction: consensusResult.direction,
      confidence: consensusResult.confidence,
      signalCount: signals.length,
      weightedScore: consensusResult.weightedScore,
    };

    // 2. Pick the representative signal (highest weighted confidence in consensus direction)
    const representativeSignal = this.pickRepresentativeSignal(signals, consensus.direction, credibilities);
    if (!representativeSignal) {
      return this.rejectDecision(decisionId, signals, "No signal aligns with consensus direction");
    }

    // 3. Run risk checks
    const dailyTradeCount = await this.deps.getDailyTradeCount();
    const marketState = await this.deps.getMarketState(representativeSignal.instrument);
    const newsFilter = await this.deps.getNewsFilter();

    const riskChecks = runAllRiskChecks(
      representativeSignal,
      consensus.confidence,
      dailyTradeCount,
      marketState,
      newsFilter,
      this.config
    );

    const allRiskChecksPassed = riskChecks.every((rc) => rc.passed);

    if (!allRiskChecksPassed) {
      const failedRules = riskChecks.filter((rc) => !rc.passed).map((rc) => rc.reason ?? rc.rule);
      return {
        decisionId,
        consensus,
        riskChecks,
        allRiskChecksPassed: false,
        capitalRequested: 0,
        capitalApproved: false,
        approved: false,
        rejectionReason: `Risk checks failed: ${failedRules.join("; ")}`,
        contributingSignals: signals,
        timestamp: now(),
      };
    }

    // 4. Request capital from Treasurer
    // Capital amount is determined by the Treasurer's scale factor
    const capitalRequested = 100; // Placeholder — actual sizing done by Treasurer based on scale
    const capitalResponse = await this.deps.requestCapital(
      decisionId,
      capitalRequested,
      representativeSignal.assetClass,
      representativeSignal.instrument
    );

    const decision: FCDecision = {
      decisionId,
      consensus,
      riskChecks,
      allRiskChecksPassed: true,
      capitalRequested,
      capitalApproved: capitalResponse.approved,
      approved: capitalResponse.approved,
      rejectionReason: capitalResponse.approved ? undefined : `Capital rejected: ${capitalResponse.rejectionReason ?? "insufficient"}`,
      contributingSignals: signals,
      timestamp: now(),
    };

    return decision;
  }

  /**
   * Pick the signal that best represents the consensus direction.
   */
  private pickRepresentativeSignal(
    signals: AgentSignal[],
    direction: "long" | "short",
    credibilities: Map<string, number>
  ): AgentSignal | null {
    const aligned = signals.filter((s) => s.direction === direction);
    if (aligned.length === 0) return null;

    // Pick highest weighted confidence (credibility × confidence)
    let best: AgentSignal | null = null;
    let bestWeight = -1;
    for (const signal of aligned) {
      const cred = credibilities.get(signal.agentId) ?? 0.5;
      const weight = cred * signal.confidence;
      if (weight > bestWeight) {
        bestWeight = weight;
        best = signal;
      }
    }

    return best;
  }

  private rejectDecision(
    decisionId: string,
    signals: AgentSignal[],
    reason: string
  ): FCDecision {
    return {
      decisionId,
      consensus: { direction: "long", confidence: 0, signalCount: 0, weightedScore: 0 },
      riskChecks: [],
      allRiskChecksPassed: false,
      capitalRequested: 0,
      capitalApproved: false,
      approved: false,
      rejectionReason: reason,
      contributingSignals: signals,
      timestamp: now(),
    };
  }
}
