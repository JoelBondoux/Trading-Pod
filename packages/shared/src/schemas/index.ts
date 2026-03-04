// ============================================================================
// Zod Schemas — Runtime validation for all message types
// ============================================================================

import { z } from "zod";

// --- Agent Signal Schema ---
export const AgentSignalSchema = z.object({
  signalId: z.string().uuid(),
  agentId: z.string().min(1),
  source: z.enum(["internal", "tradingview"]),
  assetClass: z.enum(["fx", "crypto"]),
  instrument: z.string().min(1),
  direction: z.enum(["long", "short"]),
  confidence: z.number().min(0).max(1),
  stopLoss: z.number().positive(),
  takeProfit: z.number().positive(),
  holdingTimeMinutes: z.number().positive().int(),
  justification: z.string().min(1),
  currentPrice: z.number().positive(),
  timestamp: z.string().datetime(),
});

// --- FC Decision Schema ---
export const WeightedConsensusSchema = z.object({
  direction: z.enum(["long", "short"]),
  confidence: z.number().min(0).max(1),
  signalCount: z.number().int().nonnegative(),
  weightedScore: z.number(),
});

export const RiskCheckSchema = z.object({
  rule: z.string(),
  passed: z.boolean(),
  reason: z.string().optional(),
});

export const FCDecisionSchema = z.object({
  decisionId: z.string().uuid(),
  consensus: WeightedConsensusSchema,
  riskChecks: z.array(RiskCheckSchema),
  allRiskChecksPassed: z.boolean(),
  capitalRequested: z.number().nonnegative(),
  capitalApproved: z.boolean(),
  approved: z.boolean(),
  rejectionReason: z.string().optional(),
  contributingSignals: z.array(AgentSignalSchema),
  timestamp: z.string().datetime(),
});

// --- Treasurer Schemas ---
export const CapitalRequestSchema = z.object({
  decisionId: z.string().uuid(),
  amount: z.number().positive(),
  assetClass: z.enum(["fx", "crypto"]),
  instrument: z.string().min(1),
  timestamp: z.string().datetime(),
});

export const CapitalResponseSchema = z.object({
  approved: z.boolean(),
  allocatedAmount: z.number().nonnegative(),
  rejectionReason: z.string().optional(),
  dailyRemaining: z.number().nonnegative(),
  timestamp: z.string().datetime(),
});

export const CapitalReturnSchema = z.object({
  executionId: z.string().uuid(),
  capitalReturned: z.number().nonnegative(),
  pnl: z.number(),
  assetClass: z.enum(["fx", "crypto"]),
  timestamp: z.string().datetime(),
});

// --- Trade Execution Schema ---
export const TradeExecutionSchema = z.object({
  executionId: z.string().uuid(),
  decisionId: z.string().uuid(),
  assetClass: z.enum(["fx", "crypto"]),
  instrument: z.string().min(1),
  direction: z.enum(["long", "short"]),
  entryPrice: z.number().positive(),
  stopLoss: z.number().positive(),
  takeProfit: z.number().positive(),
  positionSize: z.number().positive(),
  capitalAllocated: z.number().positive(),
  spread: z.number().nonnegative(),
  slippage: z.number(),
  brokerOrderId: z.string().optional(),
  broker: z.string().min(1),
  status: z.enum([
    "pending",
    "submitted",
    "filled",
    "partially_filled",
    "cancelled",
    "closed",
    "error",
  ]),
  exitPrice: z.number().positive().optional(),
  pnl: z.number().optional(),
  fees: z.number().nonnegative(),
  openedAt: z.string().datetime(),
  closedAt: z.string().datetime().optional(),
  errorMessage: z.string().optional(),
});

// --- TradingView Webhook Schema ---
export const TradingViewWebhookSchema = z.object({
  secret: z.string().min(1),
  ticker: z.string().min(1),
  action: z.enum(["buy", "sell"]),
  price: z.number().positive(),
  stopLoss: z.number().positive(),
  takeProfit: z.number().positive(),
  confidence: z.number().min(0).max(1).default(0.7),
  holdingTimeMinutes: z.number().positive().int().default(60),
  justification: z.string().default("TradingView alert signal"),
  assetClass: z.enum(["fx", "crypto"]),
  agentId: z.string().default("tradingview_pine"),
});
