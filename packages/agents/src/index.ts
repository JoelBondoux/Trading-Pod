// ============================================================================
// @trading-pod/agents — Barrel export
// ============================================================================

// Protocol
export type { SignalAgent, SignalAgentFactory, MarketDataSnapshot } from "./shared_agent_protocols.js";

// Agents
export { TrendAgent, createTrendAgent } from "./trend_agent/index.js";
export { MeanReversionAgent, createMeanReversionAgent } from "./mean_reversion_agent/index.js";
export { VolatilityAgent, createVolatilityAgent } from "./volatility_agent/index.js";
export { MomentumAgent, createMomentumAgent } from "./momentum_agent/index.js";

// Credibility
export {
  updateCredibility,
  applyIdleDecay,
  computeWeightedConsensus,
  createInitialCredibility,
  processTradeOutcome,
} from "./credibility_manager.js";
