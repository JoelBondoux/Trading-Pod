import { FX_INSTRUMENTS } from "@trading-pod/shared";
import { z } from "zod";
import { AccountIdSchema, CurrencySchema } from "./config.js";

// Keep money and identifiers as strings. In particular, IDs can exceed 2^53.
export const DecimalSchema = z.string().regex(/^-?(?:0|[1-9]\d{0,29})(?:\.\d{1,20})?$/);
export const IdSchema = z.string().regex(/^(?:0|[1-9]\d{0,29})$/);
export const TimeSchema = z.string().datetime({ offset: true });
export const PositiveSchema = DecimalSchema.refine((value) => compareDecimal(value, "0") > 0);
const NonnegativeSchema = DecimalSchema.refine((value) => compareDecimal(value, "0") >= 0);
const InstrumentNameSchema = z.string().regex(/^[A-Z0-9]+_[A-Z0-9]+$/).max(64);

export function compareDecimal(left: string, right: string): number {
  const [a, af = ""] = left.split(".");
  const [b, bf = ""] = right.split(".");
  const scale = Math.max(af.length, bf.length);
  const av = BigInt(a + af.padEnd(scale, "0"));
  const bv = BigInt(b + bf.padEnd(scale, "0"));
  return av < bv ? -1 : av > bv ? 1 : 0;
}

const OrderSchema = z.object({
  id: IdSchema, type: z.string().min(1), instrument: InstrumentNameSchema.optional(),
}).passthrough();
const TradeSchema = z.object({
  id: IdSchema, instrument: InstrumentNameSchema, currentUnits: DecimalSchema,
}).passthrough();
const PositionSchema = z.object({
  instrument: InstrumentNameSchema,
  long: z.object({ units: NonnegativeSchema }).passthrough(),
  short: z.object({ units: DecimalSchema.refine((value) => compareDecimal(value, "0") <= 0) }).passthrough(),
}).passthrough();
export const AccountResponseSchema = z.object({
  account: z.object({
    id: AccountIdSchema,
    currency: CurrencySchema,
    balance: DecimalSchema,
    NAV: DecimalSchema,
    marginAvailable: DecimalSchema,
    marginUsed: NonnegativeSchema,
    marginRate: PositiveSchema,
    openTradeCount: z.number().int().nonnegative(),
    openPositionCount: z.number().int().nonnegative(),
    pendingOrderCount: z.number().int().nonnegative(),
    lastTransactionID: IdSchema,
    trades: z.array(TradeSchema),
    orders: z.array(OrderSchema),
    positions: z.array(PositionSchema),
  }).passthrough(),
  lastTransactionID: IdSchema,
}).passthrough();
export type AccountResponse = z.infer<typeof AccountResponseSchema>;

export const InstrumentsResponseSchema = z.object({
  instruments: z.array(z.object({
    name: z.enum(FX_INSTRUMENTS),
    type: z.literal("CURRENCY"),
    displayPrecision: z.number().int().min(0).max(12),
    pipLocation: z.number().int().min(-12).max(0),
    tradeUnitsPrecision: z.number().int().min(0).max(12),
    minimumTradeSize: PositiveSchema,
    maximumOrderUnits: PositiveSchema,
    maximumPositionSize: NonnegativeSchema,
    marginRate: PositiveSchema,
  }).passthrough()),
  lastTransactionID: IdSchema,
}).passthrough();

const BucketSchema = z.object({ price: PositiveSchema, liquidity: z.number().int().nonnegative() });
export const PricingResponseSchema = z.object({
  time: TimeSchema,
  prices: z.array(z.object({
    instrument: z.enum(FX_INSTRUMENTS),
    time: TimeSchema,
    tradeable: z.boolean(),
    status: z.enum(["tradeable", "non-tradeable", "invalid"]).optional(),
    bids: z.array(BucketSchema),
    asks: z.array(BucketSchema),
    closeoutBid: PositiveSchema,
    closeoutAsk: PositiveSchema,
  }).passthrough()),
  homeConversions: z.array(z.object({
    currency: CurrencySchema,
    accountGain: PositiveSchema,
    accountLoss: PositiveSchema,
    positionValue: PositiveSchema,
  }).passthrough()),
}).passthrough();
export type PricingResponse = z.infer<typeof PricingResponseSchema>;

// Retain all types and fields, including non-FX transactions and financing.
// This is an observation envelope, not a ledger reducer or an order-fill model.
export const TransactionSchema = z.object({
  id: IdSchema, accountID: AccountIdSchema, time: TimeSchema,
  type: z.string().regex(/^[A-Z][A-Z0-9_]+$/).max(100),
  batchID: IdSchema,
}).passthrough();
export const TransactionsResponseSchema = z.object({
  transactions: z.array(TransactionSchema).max(1000),
  lastTransactionID: IdSchema,
}).passthrough();

export const observedSchema = <T extends z.ZodTypeAny>(value: T) => z.object({
  requestedAt: TimeSchema,
  receivedAt: TimeSchema,
  value,
});
export type Observed<T> = { requestedAt: string; receivedAt: string; value: T };
