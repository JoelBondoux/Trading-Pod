// ============================================================================
// Broker Adapter — Interface + Mock, IG, and Kraken adapters
// ============================================================================

import type { BrokerOrder, BrokerOrderResponse } from "@trading-pod/shared";
import { generateId, now } from "@trading-pod/shared";

/**
 * Broker adapter interface.
 * All broker integrations implement this contract.
 */
export interface BrokerAdapter {
  /** Broker identifier */
  readonly name: string;

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

  async placeOrder(order: BrokerOrder): Promise<BrokerOrderResponse> {
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
 * TODO: Implement full IG REST API integration
 * - POST /session (authenticate, get CST + security token)
 * - POST /positions/otc (open position)
 * - PUT /positions/otc/:dealId (update SL/TP)
 * - DELETE /positions/otc/:dealId (close position)
 */
export class IGBrokerAdapter implements BrokerAdapter {
  readonly name = "ig";

  constructor(
    private readonly config: IGConfig,
    private readonly baseUrl = config.demo
      ? "https://demo-api.ig.com/gateway/deal"
      : "https://api.ig.com/gateway/deal",
  ) {}

  async placeOrder(_order: BrokerOrder): Promise<BrokerOrderResponse> {
    // TODO: Implement IG API integration
    // 1. Authenticate via POST /session
    // 2. Create position via POST /positions/otc
    // 3. Parse deal reference and confirm via GET /confirms/:dealReference
    throw new Error(`IG broker adapter (${this.baseUrl}) not yet implemented. API key: ${this.config.apiKey.slice(0, 4)}…`);
  }

  async cancelOrder(_orderId: string): Promise<boolean> {
    throw new Error(`IG broker adapter (${this.baseUrl}) not yet implemented.`);
  }

  async healthCheck(): Promise<boolean> {
    // TODO: Test authentication via POST /session
    void this.config;
    return false;
  }
}

// ============================================================================
// Kraken Broker Adapter — Crypto Spot (Stub)
// ============================================================================

export interface KrakenConfig {
  apiKey: string;
  apiSecret: string;
}

/**
 * Kraken broker adapter for spot crypto trading.
 * Uses Kraken REST API.
 *
 * TODO: Implement full Kraken REST API integration
 * - POST /0/private/AddOrder (place order)
 * - POST /0/private/CancelOrder (cancel order)
 * - POST /0/private/QueryOrders (check order status)
 * - Authentication: API-Key header + API-Sign (HMAC-SHA512)
 */
export class KrakenBrokerAdapter implements BrokerAdapter {
  readonly name = "kraken";
  private readonly baseUrl = "https://api.kraken.com";

  constructor(private readonly config: KrakenConfig) {}

  async placeOrder(_order: BrokerOrder): Promise<BrokerOrderResponse> {
    // TODO: Implement Kraken API integration
    // 1. Build request body (pair, type, ordertype, volume, price, etc.)
    // 2. Generate nonce and HMAC-SHA512 signature
    // 3. POST /0/private/AddOrder
    // 4. Parse txid from response
    throw new Error(`Kraken adapter (${this.baseUrl}) not yet implemented. Key: ${this.config.apiKey.slice(0, 4)}…`);
  }

  async cancelOrder(_orderId: string): Promise<boolean> {
    throw new Error(`Kraken adapter (${this.baseUrl}) not yet implemented.`);
  }

  async healthCheck(): Promise<boolean> {
    // TODO: Test via GET /0/public/SystemStatus
    void this.config;
    return false;
  }
}

// ============================================================================
// Adapter Factory
// ============================================================================

export type BrokerAdapterType = "mock" | "ig" | "kraken";

export function createBrokerAdapter(
  type: BrokerAdapterType,
  config?: IGConfig | KrakenConfig
): BrokerAdapter {
  switch (type) {
    case "mock":
      return new MockBrokerAdapter();
    case "ig":
      if (!config) throw new Error("IG config required");
      return new IGBrokerAdapter(config as IGConfig);
    case "kraken":
      if (!config) throw new Error("Kraken config required");
      return new KrakenBrokerAdapter(config as KrakenConfig);
    default:
      throw new Error(`Unknown broker adapter type: ${type}`);
  }
}

/**
 * Select the appropriate broker adapter based on asset class.
 * FX → IG (spread betting, tax-free)
 * Crypto → Kraken (spot)
 */
export function selectBrokerForAsset(
  assetClass: "fx" | "crypto",
  adapters: { ig: BrokerAdapter; kraken: BrokerAdapter; mock: BrokerAdapter }
): BrokerAdapter {
  switch (assetClass) {
    case "fx":
      return adapters.ig;
    case "crypto":
      return adapters.kraken;
    default:
      return adapters.mock;
  }
}
