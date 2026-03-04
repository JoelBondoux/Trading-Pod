// ============================================================================
// Risk Rules — Pure deterministic risk check functions
// ============================================================================

import type {
  AgentSignal,
  RiskCheck,
  RiskRuleConfig,
} from "@trading-pod/shared";
import { rewardRiskRatio, percentDiff } from "@trading-pod/shared";
import type { MarketStateOutput, NewsFilterOutput } from "@trading-pod/shared";

/**
 * Check minimum reward-to-risk ratio.
 */
export function checkMinRR(
  signal: AgentSignal,
  config: RiskRuleConfig
): RiskCheck {
  const rr = rewardRiskRatio(
    signal.currentPrice,
    signal.stopLoss,
    signal.takeProfit,
    signal.direction
  );

  return {
    rule: "min_reward_risk_ratio",
    passed: rr >= config.minRewardRiskRatio,
    reason: rr < config.minRewardRiskRatio
      ? `RR ratio ${rr.toFixed(2)} below minimum ${config.minRewardRiskRatio}`
      : undefined,
  };
}

/**
 * Check stop-loss distance bounds (not too tight, not too wide).
 */
export function checkSLBounds(
  signal: AgentSignal,
  config: RiskRuleConfig
): RiskCheck {
  const slPercent = percentDiff(signal.currentPrice, signal.stopLoss);

  if (slPercent > config.maxStopLossPercent) {
    return {
      rule: "stop_loss_bounds",
      passed: false,
      reason: `SL distance ${slPercent.toFixed(2)}% exceeds max ${config.maxStopLossPercent}%`,
    };
  }

  if (slPercent < config.minStopLossPercent) {
    return {
      rule: "stop_loss_bounds",
      passed: false,
      reason: `SL distance ${slPercent.toFixed(2)}% below min ${config.minStopLossPercent}%`,
    };
  }

  return { rule: "stop_loss_bounds", passed: true };
}

/**
 * Check max daily trade count.
 */
export function checkMaxDailyTrades(
  currentDailyTrades: number,
  config: RiskRuleConfig
): RiskCheck {
  return {
    rule: "max_daily_trades",
    passed: currentDailyTrades < config.maxTradesPerDay,
    reason:
      currentDailyTrades >= config.maxTradesPerDay
        ? `Daily trade limit reached (${currentDailyTrades}/${config.maxTradesPerDay})`
        : undefined,
  };
}

/**
 * Check minimum confidence threshold.
 */
export function checkMinConfidence(
  aggregatedConfidence: number,
  config: RiskRuleConfig
): RiskCheck {
  return {
    rule: "min_confidence",
    passed: aggregatedConfidence >= config.minConfidence,
    reason:
      aggregatedConfidence < config.minConfidence
        ? `Aggregated confidence ${(aggregatedConfidence * 100).toFixed(1)}% below threshold ${(config.minConfidence * 100).toFixed(1)}%`
        : undefined,
  };
}

/**
 * Check volatility regime gate.
 */
export function checkVolatilityRegime(
  marketState: MarketStateOutput | null,
  config: RiskRuleConfig
): RiskCheck {
  if (!marketState) {
    return { rule: "volatility_regime", passed: true, reason: "No market state data available — passing by default" };
  }

  const blocked = config.blockedRegimes.includes(marketState.regime);
  return {
    rule: "volatility_regime",
    passed: !blocked,
    reason: blocked
      ? `Market regime "${marketState.regime}" is in blocked list`
      : undefined,
  };
}

/**
 * Check news window block.
 */
export function checkNewsWindow(
  newsFilter: NewsFilterOutput | null
): RiskCheck {
  if (!newsFilter) {
    return { rule: "news_window", passed: true, reason: "No news filter data — passing by default" };
  }

  return {
    rule: "news_window",
    passed: !newsFilter.block,
    reason: newsFilter.block
      ? `News window block active: ${newsFilter.reason ?? "high-impact event"} (${newsFilter.blockRemainingMinutes ?? "?"} min remaining)`
      : undefined,
  };
}

/**
 * Run all risk checks and return results.
 */
export function runAllRiskChecks(
  signal: AgentSignal,
  aggregatedConfidence: number,
  currentDailyTrades: number,
  marketState: MarketStateOutput | null,
  newsFilter: NewsFilterOutput | null,
  config: RiskRuleConfig
): RiskCheck[] {
  return [
    checkMinRR(signal, config),
    checkSLBounds(signal, config),
    checkMaxDailyTrades(currentDailyTrades, config),
    checkMinConfidence(aggregatedConfidence, config),
    checkVolatilityRegime(marketState, config),
    checkNewsWindow(newsFilter),
  ];
}
