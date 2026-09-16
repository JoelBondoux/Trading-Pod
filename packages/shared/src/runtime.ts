import { z } from "zod";

/** Deployment modes are distinct from execution readiness. No mode arms this build. */
export const RuntimeModeSchema = z.enum(["RESEARCH", "SHADOW", "OANDA_PRACTICE", "LIVE_LOCKED"]);
export type RuntimeMode = z.infer<typeof RuntimeModeSchema>;

export const FX_INSTRUMENTS = Object.freeze(["EUR_USD", "GBP_USD", "USD_JPY"] as const);
export type FxInstrument = (typeof FX_INSTRUMENTS)[number];

const FX_ALIASES: Readonly<Record<string, FxInstrument>> = Object.freeze({
  EUR_USD: "EUR_USD",
  "EUR/USD": "EUR_USD",
  EURUSD: "EUR_USD",
  GBP_USD: "GBP_USD",
  "GBP/USD": "GBP_USD",
  GBPUSD: "GBP_USD",
  USD_JPY: "USD_JPY",
  "USD/JPY": "USD_JPY",
  USDJPY: "USD_JPY",
});

/** Explicit aliases only: never infer eligibility by stripping punctuation. */
export const FxInstrumentSchema = z.string().transform((value, ctx) => {
  if (!Object.hasOwn(FX_ALIASES, value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Instrument is outside the FX allowlist",
    });
    return z.NEVER;
  }
  return FX_ALIASES[value];
});

export const OANDA_PRACTICE_ENDPOINTS = Object.freeze({
  rest: "https://api-fxpractice.oanda.com",
  stream: "https://stream-fxpractice.oanda.com",
});

/** Contract for the weekend review; the trading daemon scheduler is a later milestone. */
export const WEEKLY_REVIEW = Object.freeze({
  day: "Saturday",
  time: "09:00",
  timezone: "Europe/London",
});

export function getRuntimeStatus(configuredMode?: string) {
  const parsed = RuntimeModeSchema.safeParse(configuredMode ?? "RESEARCH");
  return {
    mode: parsed.success ? parsed.data : ("LIVE_LOCKED" as const),
    configurationValid: parsed.success,
    operationalState: "PAUSED" as const,
    executionEnabled: false as const,
    liveEnabled: false as const,
    broker: "OANDA_PRACTICE" as const,
    brokerConnected: false as const,
    allowedInstruments: FX_INSTRUMENTS,
    weeklyReview: WEEKLY_REVIEW,
    reason: parsed.success
      ? "Execution is locked until risk reservations, reconciliation and protective orders are implemented."
      : "Invalid TRADING_MODE. Execution is locked.",
  };
}

export type RuntimeStatus = Omit<ReturnType<typeof getRuntimeStatus>, "allowedInstruments"> & {
  allowedInstruments: readonly FxInstrument[];
};

export const DashboardSessionSchema = z.object({
  subject: z.string().min(1),
  email: z.string().email(),
  name: z.string(),
  picture: z.string(),
  expiresAt: z.number().finite().positive(),
});

export const RuntimeStatusSchema = z.object({
  mode: RuntimeModeSchema,
  configurationValid: z.boolean(),
  operationalState: z.literal("PAUSED"),
  executionEnabled: z.literal(false),
  liveEnabled: z.literal(false),
  broker: z.literal("OANDA_PRACTICE"),
  brokerConnected: z.literal(false),
  allowedInstruments: z.array(z.enum(FX_INSTRUMENTS)),
  weeklyReview: z.object({
    day: z.literal("Saturday"),
    time: z.literal("09:00"),
    timezone: z.literal("Europe/London"),
  }),
  reason: z.string(),
});
