// ============================================================================
// @trading-pod/core — Barrel export
// ============================================================================

// Financial Controller
export { FinancialController } from "./financial_controller/fc.js";
export type { FCDependencies } from "./financial_controller/fc.js";

// Treasurer
export { Treasurer } from "./treasurer/treasurer.js";

// Savings Manager
export { SavingsManager } from "./savings_manager/savings.js";

// Tax Collector
export { TaxCollector } from "./tax_collector/tax_collector.js";

// Execution Engine
export { ExecutionEngine } from "./execution_engine/engine.js";

// Broker Adapters
export {
  MockBrokerAdapter,
  IGBrokerAdapter,
  KrakenBrokerAdapter,
  createBrokerAdapter,
  selectBrokerForAsset,
} from "./execution_engine/broker_adapter.js";
export type {
  BrokerAdapter,
  BrokerAdapterType,
  TradingMode,
  IGConfig,
  KrakenConfig,
} from "./execution_engine/broker_adapter.js";

// Risk Rules
export {
  checkMinRR,
  checkSLBounds,
  checkMaxDailyTrades,
  checkMinConfidence,
  checkVolatilityRegime,
  checkNewsWindow,
  runAllRiskChecks,
} from "./risk_rules/rules.js";

// Circuit Breaker
export {
  CircuitBreaker,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from "./circuit_breaker/circuit_breaker.js";
export type {
  CircuitBreakerConfig,
  CircuitBreakerState,
} from "./circuit_breaker/circuit_breaker.js";

// Context Providers
export { NewsFilter, createNewsFilter } from "./context_providers/news_filter.js";
export { MarketStateClassifier, createMarketStateClassifier } from "./context_providers/market_state.js";

// Currency Converter
export {
  CurrencyConverter,
  DEFAULT_CONVERTER_CONFIG,
} from "./currency/converter.js";
export type {
  ExchangeRate,
  CurrencyConverterConfig,
} from "./currency/converter.js";

// Event Bus
export { LocalEventBus } from "./event_bus/bus.js";
export type { EventBus, EventHandler } from "./event_bus/bus.js";
