// ============================================================================
// Execution Engine — Deterministic, rule-based trade execution
// ============================================================================

import type {
  FCDecision,
  TradeExecution,
  CapitalResponse,
} from "@trading-pod/shared";
import { generateId, now } from "@trading-pod/shared";
import type { BrokerAdapter } from "./broker_adapter.js";

/**
 * Execution Engine.
 * Deterministic, rule-based. Places trades via broker adapters.
 * Immediately sets SL/TP. Logs slippage, spread, and execution details.
 */
export class ExecutionEngine {
  private broker: BrokerAdapter;

  constructor(broker: BrokerAdapter) {
    this.broker = broker;
  }

  /**
   * Execute a trade based on an FC decision and capital allocation.
   */
  async execute(
    decision: FCDecision,
    capitalResponse: CapitalResponse
  ): Promise<TradeExecution> {
    const executionId = generateId();

    if (!decision.approved || !capitalResponse.approved) {
      return this.createFailedExecution(
        executionId,
        decision,
        capitalResponse,
        "Decision or capital not approved"
      );
    }

    // Use the representative signal (first contributing signal in consensus direction)
    const signal = decision.contributingSignals.find(
      (s) => s.direction === decision.consensus.direction
    );

    if (!signal) {
      return this.createFailedExecution(
        executionId,
        decision,
        capitalResponse,
        "No signal found matching consensus direction"
      );
    }

    // Calculate position size from allocated capital
    const positionSize = capitalResponse.allocatedAmount / signal.currentPrice;

    try {
      const response = await this.broker.placeOrder({
        instrument: signal.instrument,
        direction: signal.direction,
        size: positionSize,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        type: "market",
      });

      if (response.status === "rejected") {
        return this.createFailedExecution(
          executionId,
          decision,
          capitalResponse,
          `Broker rejected order: ${response.rejectionReason ?? "unknown"}`
        );
      }

      const filledPrice = response.filledPrice ?? signal.currentPrice;
      const slippage = filledPrice - signal.currentPrice;
      const spread = Math.abs(slippage) * 2; // Approximate

      const execution: TradeExecution = {
        executionId,
        decisionId: decision.decisionId,
        assetClass: signal.assetClass,
        instrument: signal.instrument,
        direction: signal.direction,
        entryPrice: filledPrice,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        positionSize: response.filledSize ?? positionSize,
        capitalAllocated: capitalResponse.allocatedAmount,
        spread,
        slippage,
        brokerOrderId: response.orderId,
        broker: this.broker.name,
        status: "filled",
        fees: response.fees,
        openedAt: now(),
      };

      return execution;
    } catch (error) {
      return this.createFailedExecution(
        executionId,
        decision,
        capitalResponse,
        `Broker error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Close a position and record the result.
   */
  async closePosition(
    execution: TradeExecution,
    exitPrice: number
  ): Promise<TradeExecution> {
    // Calculate PnL
    const priceDiff =
      execution.direction === "long"
        ? exitPrice - execution.entryPrice
        : execution.entryPrice - exitPrice;

    const pnl = priceDiff * execution.positionSize - execution.fees;

    return {
      ...execution,
      status: "closed",
      exitPrice,
      pnl,
      closedAt: now(),
    };
  }

  private createFailedExecution(
    executionId: string,
    decision: FCDecision,
    capitalResponse: CapitalResponse,
    errorMessage: string
  ): TradeExecution {
    const signal = decision.contributingSignals[0];

    return {
      executionId,
      decisionId: decision.decisionId,
      assetClass: signal?.assetClass ?? "fx",
      instrument: signal?.instrument ?? "unknown",
      direction: decision.consensus.direction,
      entryPrice: 0,
      stopLoss: 0,
      takeProfit: 0,
      positionSize: 0,
      capitalAllocated: capitalResponse.allocatedAmount,
      spread: 0,
      slippage: 0,
      broker: this.broker.name,
      status: "error",
      fees: 0,
      openedAt: now(),
      errorMessage,
    };
  }
}
