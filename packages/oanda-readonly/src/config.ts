import { isAbsolute } from "node:path";
import { FX_INSTRUMENTS } from "@trading-pod/shared";
import { z } from "zod";
import { ReadError } from "./errors.js";

export const AccountIdSchema = z.string().regex(/^\d{3}-\d{3}-\d{7}-\d{3}$/);
export const CurrencySchema = z.string().regex(/^[A-Z]{3}$/);
export const BindingSchema = z.object({
  environment: z.literal("practice"),
  accountId: AccountIdSchema,
  expectedCurrency: CurrencySchema,
  instruments: z.array(z.enum(FX_INSTRUMENTS)).min(1).max(3)
    .refine((values) => new Set(values).size === values.length),
}).strict();
export type Binding = z.infer<typeof BindingSchema>;

export const ConnectionSchema = BindingSchema.extend({
  token: z.string().min(16).max(512).regex(/^[A-Za-z0-9_-]+$/),
});
export type ConnectionConfig = z.infer<typeof ConnectionSchema>;

export function readConfig(env: NodeJS.ProcessEnv) {
  // Explicitly refuse commonly used host overrides instead of silently ignoring them.
  if (["OANDA_BASE_URL", "OANDA_REST_URL", "OANDA_STREAM_URL"].some((key) => env[key] !== undefined)) {
    throw new ReadError("CONFIG_INVALID");
  }
  const parsed = ConnectionSchema.safeParse({
    environment: env.OANDA_ENVIRONMENT,
    accountId: env.OANDA_ACCOUNT_ID,
    expectedCurrency: env.OANDA_EXPECTED_CURRENCY,
    instruments: (env.OANDA_FX_INSTRUMENTS ?? "EUR_USD").split(","),
    token: env.OANDA_API_TOKEN,
  });
  const observationDir = env.OANDA_OBSERVATION_DIR;
  const interval = env.OANDA_POLL_INTERVAL_MS ?? "5000";
  if (!parsed.success || !observationDir || !isAbsolute(observationDir) ||
      !/^\d+$/.test(interval) || Number(interval) < 1000 || Number(interval) > 60000) {
    throw new ReadError("CONFIG_INVALID");
  }
  return { connection: parsed.data, observationDir, pollIntervalMs: Number(interval) };
}

export function bindingOf(config: ConnectionConfig): Binding {
  return BindingSchema.parse({
    environment: config.environment,
    accountId: config.accountId,
    expectedCurrency: config.expectedCurrency,
    instruments: [...config.instruments].sort(),
  });
}
