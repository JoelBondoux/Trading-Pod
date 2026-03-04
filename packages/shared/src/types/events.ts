// ============================================================================
// System Events — Discriminated union for all event bus messages
// ============================================================================

import type { AgentSignal } from "./agent.js";
import type { CredibilityRecord } from "./credibility.js";
import type { FCDecision } from "./fc.js";
import type { CapitalRequest, CapitalResponse, CapitalReturn } from "./treasurer.js";
import type { TradeExecution } from "./execution.js";
import type { SavingsDeposit, SavingsState } from "./savings.js";
import type { TaxReserveEntry } from "./tax.js";
import type { MarketStateOutput, NewsFilterOutput } from "./context.js";

/** All event type discriminators */
export type EventType =
  | "agent:signal"
  | "agent:credibility_updated"
  | "fc:decision"
  | "treasurer:capital_requested"
  | "treasurer:capital_response"
  | "treasurer:capital_returned"
  | "execution:submitted"
  | "execution:filled"
  | "execution:closed"
  | "execution:error"
  | "savings:deposit"
  | "savings:state_updated"
  | "tax:reserved"
  | "context:market_state"
  | "context:news_filter"
  | "system:heartbeat"
  | "system:error";

/** Base event shape */
interface BaseEvent {
  /** Unique event ID */
  eventId: string;
  /** ISO 8601 timestamp */
  timestamp: string;
}

export interface AgentSignalEvent extends BaseEvent {
  type: "agent:signal";
  payload: AgentSignal;
}

export interface CredibilityUpdatedEvent extends BaseEvent {
  type: "agent:credibility_updated";
  payload: CredibilityRecord;
}

export interface FCDecisionEvent extends BaseEvent {
  type: "fc:decision";
  payload: FCDecision;
}

export interface CapitalRequestedEvent extends BaseEvent {
  type: "treasurer:capital_requested";
  payload: CapitalRequest;
}

export interface CapitalResponseEvent extends BaseEvent {
  type: "treasurer:capital_response";
  payload: CapitalResponse;
}

export interface CapitalReturnedEvent extends BaseEvent {
  type: "treasurer:capital_returned";
  payload: CapitalReturn;
}

export interface ExecutionSubmittedEvent extends BaseEvent {
  type: "execution:submitted";
  payload: TradeExecution;
}

export interface ExecutionFilledEvent extends BaseEvent {
  type: "execution:filled";
  payload: TradeExecution;
}

export interface ExecutionClosedEvent extends BaseEvent {
  type: "execution:closed";
  payload: TradeExecution;
}

export interface ExecutionErrorEvent extends BaseEvent {
  type: "execution:error";
  payload: TradeExecution;
}

export interface SavingsDepositEvent extends BaseEvent {
  type: "savings:deposit";
  payload: SavingsDeposit;
}

export interface SavingsStateUpdatedEvent extends BaseEvent {
  type: "savings:state_updated";
  payload: SavingsState;
}

export interface TaxReservedEvent extends BaseEvent {
  type: "tax:reserved";
  payload: TaxReserveEntry;
}

export interface MarketStateEvent extends BaseEvent {
  type: "context:market_state";
  payload: MarketStateOutput;
}

export interface NewsFilterEvent extends BaseEvent {
  type: "context:news_filter";
  payload: NewsFilterOutput;
}

export interface HeartbeatEvent extends BaseEvent {
  type: "system:heartbeat";
  payload: { uptimeSeconds: number; connectedClients: number };
}

export interface SystemErrorEvent extends BaseEvent {
  type: "system:error";
  payload: { message: string; source: string; stack?: string };
}

/** Discriminated union of all system events */
export type SystemEvent =
  | AgentSignalEvent
  | CredibilityUpdatedEvent
  | FCDecisionEvent
  | CapitalRequestedEvent
  | CapitalResponseEvent
  | CapitalReturnedEvent
  | ExecutionSubmittedEvent
  | ExecutionFilledEvent
  | ExecutionClosedEvent
  | ExecutionErrorEvent
  | SavingsDepositEvent
  | SavingsStateUpdatedEvent
  | TaxReservedEvent
  | MarketStateEvent
  | NewsFilterEvent
  | HeartbeatEvent
  | SystemErrorEvent;

/** Event topic names for routing */
export const EVENT_TOPICS = {
  AGENT_SIGNALS: "agent:signal",
  FC_DECISIONS: "fc:decision",
  TREASURER: "treasurer",
  EXECUTION: "execution",
  SAVINGS: "savings",
  TAX: "tax",
  CONTEXT: "context",
  SYSTEM: "system",
  ALL: "*",
} as const;
