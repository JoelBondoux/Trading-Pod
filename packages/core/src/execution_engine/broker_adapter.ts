// ============================================================================
// Broker Adapter — Interface + Mock, IG, Capital.com, and OANDA adapters
// ============================================================================

import type { BrokerOrder, BrokerOrderResponse } from "@trading-pod/shared";
import { generateId, now, FxInstrumentSchema, OANDA_PRACTICE_ENDPOINTS } from "@trading-pod/shared";

/**
 * Broker adapter interface.
 * All broker integrations implement this contract.
 */
export interface BrokerAdapter {
  /** Broker identifier */
  readonly name: string;

  /** Human-readable display name */
  readonly displayName: string;

  /** Asset classes this broker supports */
  readonly supportedAssets: readonly ("fx" | "crypto")[];

  /** Place a new order */
  placeOrder(order: BrokerOrder): Promise<BrokerOrderResponse>;

  /** Cancel an existing order */
  cancelOrder(orderId: string): Promise<boolean>;

  /** Check connection / authentication */
  healthCheck(): Promise<boolean>;
}

// ============================================================================
// Mock Broker Adapter — For testing and development
// ============================================================================

export class MockBrokerAdapter implements BrokerAdapter {
  readonly name = "mock";
  readonly displayName = "Mock (Paper Trading)";
  readonly supportedAssets = ["fx"] as const;

  async placeOrder(order: BrokerOrder): Promise<BrokerOrderResponse> {
    FxInstrumentSchema.parse(order.instrument);
    // Simulate a fill with slight slippage
    const slippageBps = (Math.random() - 0.5) * 2; // ±1 basis point
    const filledPrice =
      order.type === "market"
        ? order.stopLoss * 1.01 // Placeholder price
        : (order.limitPrice ?? order.stopLoss * 1.01);

    return {
      orderId: `mock-${generateId()}`,
      status: "accepted",
      filledPrice: filledPrice * (1 + slippageBps / 10000),
      filledSize: order.size,
      fees: 0,
      timestamp: now(),
    };
  }

  async cancelOrder(_orderId: string): Promise<boolean> {
    return true;
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

// ============================================================================
// Capital.com Broker Adapter — FX & Crypto CFDs (Stub)
// ============================================================================

export interface CapitalComConfig {
  /** API key from Capital.com */
  apiKey: string;
  /** Account email / identifier */
  email: string;
  /** Account password */
  password: string;
  /** true = demo, false = live */
  demo: boolean;
}

/**
 * Capital.com broker adapter for FX and crypto CFD trading.
 * Uses Capital.com REST API v1.
 *
 * Docs: https://open-api.capital.com/
 *
 * TODO: Implement full Capital.com REST API integration
 * - POST /api/v1/session (authenticate, get CST + X-SECURITY-TOKEN)
 * - POST /api/v1/positions (open position)
 * - PUT  /api/v1/positions/:dealId (update SL/TP)
 * - DELETE /api/v1/positions/:dealId (close position)
 * - GET  /api/v1/positions (list open positions)
 */
export class CapitalComBrokerAdapter implements BrokerAdapter {
  readonly name = "capital";
  readonly displayName = "Capital.com";
  readonly supportedAssets = ["fx", "crypto"] as const;

  constructor(private readonly config: CapitalComConfig) {
    if (config.demo !== true) throw new Error("Live execution is locked");
  }

  async placeOrder(_order: BrokerOrder): Promise<BrokerOrderResponse> {
    // TODO: Implement Capital.com API integration
    // 1. Authenticate via POST /api/v1/session
    // 2. Create position via POST /api/v1/positions
    // 3. Parse dealReference and confirm via GET /api/v1/confirms/:dealReference
    throw new Error("Capital.com broker adapter not yet implemented");
  }

  async cancelOrder(_orderId: string): Promise<boolean> {
    throw new Error("Capital.com adapter is out of scope and not yet implemented.");
  }

  async healthCheck(): Promise<boolean> {
    // TODO: Test authentication via POST /api/v1/session
    void this.config;
    return false;
  }
}

// ============================================================================
// OANDA Broker Adapter — FX practice only (locked stub)
// ============================================================================

export interface OandaConfig {
  /** OANDA API access token (from fxTrade account settings) */
  apiToken: string;
  /** OANDA account ID (e.g., "101-004-12345678-001") */
  accountId: string;
  /** Must be true. Live accounts are not supported. */
  demo: boolean;
}

/**
 * OANDA practice broker stub. It cannot submit orders in this milestone.
 * Uses OANDA v20 REST API.
 *
 * Docs: https://developer.oanda.com/rest-live-v20/introduction/
 *
 * TODO: Implement full OANDA v20 REST API integration
 * - POST /v3/accounts/:id/orders (place order)
 * - PUT  /v3/accounts/:id/orders/:orderId (modify order)
 * - PUT  /v3/accounts/:id/orders/:orderId/cancel (cancel order)
 * - PUT  /v3/accounts/:id/trades/:tradeId/close (close trade)
 * - GET  /v3/accounts/:id (account summary / health check)
 * - Authentication: Bearer token in "Authorization" header
 */
export class OandaBrokerAdapter implements BrokerAdapter {
  readonly name = "oanda";
  readonly displayName = "OANDA Practice (locked)";
  readonly supportedAssets = ["fx"] as const;
  readonly baseUrl = OANDA_PRACTICE_ENDPOINTS.rest;

  constructor(private readonly config: OandaConfig) {
    if (config.demo !== true) throw new Error("Live execution is locked");
  }

  async placeOrder(_order: BrokerOrder): Promise<BrokerOrderResponse> {
    // TODO: Implement OANDA v20 API integration
    // 1. POST /v3/accounts/:accountId/orders with MarketOrderRequest
    // 2. Parse orderFillTransaction from response
    // 3. Map fill details to BrokerOrderResponse
    throw new Error("OANDA broker adapter not yet implemented");
  }

  async cancelOrder(_orderId: string): Promise<boolean> {
    throw new Error(`OANDA adapter (${this.baseUrl}) not yet implemented.`);
  }

  async healthCheck(): Promise<boolean> {
    // TODO: GET /v3/accounts/:accountId and check status
    void this.config;
    return false;
  }
}

// ============================================================================
// IG Broker Adapter — FX Spread Betting (Stub)
// ============================================================================

export interface IGConfig {
  apiKey: string;
  username: string;
  password: string;
  /** true = demo, false = live */
  demo: boolean;
}

/**
 * IG broker adapter for FX spread betting.
 * Uses IG REST API v1.
 *
 * Docs: https://labs.ig.com/rest-trading-api-reference
 *
 * TODO: Implement full IG REST API integration
 * - POST /session (authenticate, get CST + security token)
 * - POST /positions/otc (open position)
 * - PUT /positions/otc/:dealId (update SL/TP)
 * - DELETE /positions/otc/:dealId (close position)
 */
export class IGBrokerAdapter implements BrokerAdapter {
  readonly name = "ig";
  readonly displayName = "IG";
  readonly supportedAssets = ["fx"] as const;

  constructor(private readonly config: IGConfig) {
    if (config.demo !== true) throw new Error("Live execution is locked");
  }

  async placeOrder(_order: BrokerOrder): Promise<BrokerOrderResponse> {
    // TODO: Implement IG API integration
    // 1. Authenticate via POST /session
    // 2. Create position via POST /positions/otc
    // 3. Parse deal reference and confirm via GET /confirms/:dealReference
    throw new Error("IG broker adapter not yet implemented");
  }

  async cancelOrder(_orderId: string): Promise<boolean> {
    throw new Error("IG adapter is out of scope and not yet implemented.");
  }

  async healthCheck(): Promise<boolean> {
    // TODO: Test authentication via POST /session
    void this.config;
    return false;
  }
}

// ============================================================================
// Adapter Factory
// ============================================================================

export type BrokerAdapterType = "mock" | "ig" | "capital" | "oanda";

export function createBrokerAdapter(
  type: BrokerAdapterType,
  config?: IGConfig | CapitalComConfig | OandaConfig,
): BrokerAdapter {
  switch (type) {
    case "mock":
      return new MockBrokerAdapter();
    case "ig":
    case "capital":
      throw new Error("Only OANDA practice is in scope");
    case "oanda":
      if (!config) throw new Error("OANDA config required");
      return new OandaBrokerAdapter(config as OandaConfig);
    default:
      throw new Error(`Unknown broker adapter type: ${type}`);
  }
}

/** Legacy simulation API. Every non-paper mode is rejected. */
export type TradingMode = "paper" | "live";

/**
 * Broker preferences per asset class.
 * Retained for offline compatibility only; the dashboard cannot change brokers.
 */
export interface BrokerPreferences {
  fx: BrokerAdapterType;
  crypto: BrokerAdapterType;
}

export const DEFAULT_BROKER_PREFERENCES: BrokerPreferences = {
  fx: "oanda",
  crypto: "mock",
};

/**
 * Available broker adapters keyed by type.
 */
export type BrokerAdapterMap = Partial<Record<BrokerAdapterType, BrokerAdapter>> & {
  mock: BrokerAdapter;
};

/**
 * Legacy simulation selector. Never silently substitute a mock for a broker.
 * Practice execution will use a separate reconciled lifecycle, not this simulator.
 */
export function selectBrokerForAsset(
  assetClass: "fx" | "crypto",
  adapters: BrokerAdapterMap,
  mode: TradingMode = "paper",
  _preferences: BrokerPreferences = DEFAULT_BROKER_PREFERENCES,
): BrokerAdapter {
  if (assetClass !== "fx") throw new Error("Only FX is in scope");
  if (mode !== "paper") throw new Error("Broker execution is locked");
  if (!(adapters.mock instanceof MockBrokerAdapter))
    throw new Error("An offline mock adapter is required");
  return adapters.mock;
}
