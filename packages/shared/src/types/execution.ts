// ============================================================================
// Execution Engine Types — Trade execution and broker contracts
// ============================================================================

import type { AssetClass, Direction } from "./agent.js";

/** Trade execution status lifecycle */
export type TradeStatus =
  | "pending"
  | "submitted"
  | "filled"
  | "partially_filled"
  | "cancelled"
  | "closed"
  | "error";

/** Trade execution record */
export interface TradeExecution {
  /** Unique execution identifier */
  executionId: string;

  /** FC decision that triggered this trade */
  decisionId: string;

  /** Asset class */
  assetClass: AssetClass;

  /** Trading pair / instrument */
  instrument: string;

  /** Trade direction */
  direction: Direction;

  /** Entry price */
  entryPrice: number;

  /** Stop-loss price */
  stopLoss: number;

  /** Take-profit price */
  takeProfit: number;

  /** Position size (units) */
  positionSize: number;

  /** Capital allocated to this trade */
  capitalAllocated: number;

  /** Measured spread at execution */
  spread: number;

  /** Measured slippage at execution */
  slippage: number;

  /** Broker-specific order ID */
  brokerOrderId?: string;

  /** Broker name (mock, ig, capital, oanda) */
  broker: string;

  /** Current status */
  status: TradeStatus;

  /** Exit price (when closed) */
  exitPrice?: number;

  /** Realised PnL (when closed) */
  pnl?: number;

  /** Broker fees */
  fees: number;

  /** ISO 8601 timestamp — when opened */
  openedAt: string;

  /** ISO 8601 timestamp — when closed */
  closedAt?: string;

  /** Error message (if status is error) */
  errorMessage?: string;
}

/** Broker adapter interface contract */
export interface BrokerOrder {
  instrument: string;
  direction: Direction;
  size: number;
  stopLoss: number;
  takeProfit: number;
  type: "market" | "limit";
  limitPrice?: number;
}

/** Broker order response */
export interface BrokerOrderResponse {
  orderId: string;
  status: "accepted" | "rejected";
  filledPrice?: number;
  filledSize?: number;
  fees: number;
  rejectionReason?: string;
  timestamp: string;
}
