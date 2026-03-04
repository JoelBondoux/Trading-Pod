// ============================================================================
// @trading-pod/shared — Barrel export
// ============================================================================

// Types
export type {
  AgentSignal,
  AgentMeta,
  AssetClass,
  Direction,
} from "./types/agent.js";

export type {
  CredibilityRecord,
  CredibilityParams,
} from "./types/credibility.js";
export { DEFAULT_CREDIBILITY_PARAMS } from "./types/credibility.js";

export type {
  FCDecision,
  RiskCheck,
  WeightedConsensus,
  RiskRuleConfig,
} from "./types/fc.js";
export { DEFAULT_RISK_RULES } from "./types/fc.js";

export type {
  TreasurerState,
  CapitalRequest,
  CapitalResponse,
  CapitalReturn,
} from "./types/treasurer.js";
export { DEFAULT_TREASURER_CONFIG } from "./types/treasurer.js";

export type {
  TradeExecution,
  TradeStatus,
  BrokerOrder,
  BrokerOrderResponse,
} from "./types/execution.js";

export type { SavingsDeposit, SavingsState } from "./types/savings.js";

export type {
  TaxReserveEntry,
  TaxReserveState,
  TaxCollectorConfig,
} from "./types/tax.js";
export { DEFAULT_TAX_CONFIG, getUKTaxYear } from "./types/tax.js";

export type {
  MarketRegime,
  MarketStateOutput,
  NewsFilterOutput,
} from "./types/context.js";

export type {
  SystemEvent,
  EventType,
  AgentSignalEvent,
  CredibilityUpdatedEvent,
  FCDecisionEvent,
  CapitalRequestedEvent,
  CapitalResponseEvent,
  CapitalReturnedEvent,
  ExecutionSubmittedEvent,
  ExecutionFilledEvent,
  ExecutionClosedEvent,
  ExecutionErrorEvent,
  SavingsDepositEvent,
  SavingsStateUpdatedEvent,
  TaxReservedEvent,
  MarketStateEvent,
  NewsFilterEvent,
  HeartbeatEvent,
  SystemErrorEvent,
} from "./types/events.js";
export { EVENT_TOPICS } from "./types/events.js";

// Schemas
export {
  AgentSignalSchema,
  FCDecisionSchema,
  WeightedConsensusSchema,
  RiskCheckSchema,
  CapitalRequestSchema,
  CapitalResponseSchema,
  CapitalReturnSchema,
  TradeExecutionSchema,
  TradingViewWebhookSchema,
} from "./schemas/index.js";

// Utils
export {
  clamp,
  formatGBP,
  formatUSD,
  generateId,
  now,
  rewardRiskRatio,
  percentDiff,
  sleep,
} from "./utils/index.js";

// Auth
export {
  validateInternalRequest,
  validateDashboardToken,
  forbidden,
  internalError,
} from "./auth/index.js";
