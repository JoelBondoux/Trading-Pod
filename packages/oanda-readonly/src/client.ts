import { OANDA_PRACTICE_ENDPOINTS } from "@trading-pod/shared";
import { z } from "zod";
import { ConnectionSchema, type ConnectionConfig, bindingOf } from "./config.js";
import { ReadError } from "./errors.js";
import {
  AccountResponseSchema, InstrumentsResponseSchema, PricingResponseSchema,
  TransactionsResponseSchema, IdSchema, compareDecimal, type Observed,
} from "./schemas.js";

const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 10000;

export class OandaReadOnlyClient {
  readonly #config: ConnectionConfig;
  readonly #fetch: typeof fetch;
  readonly #now: () => Date;

  constructor(config: ConnectionConfig, dependencies: { fetch?: typeof fetch; now?: () => Date } = {}) {
    const parsed = ConnectionSchema.safeParse(config);
    if (!parsed.success) throw new ReadError("CONFIG_INVALID");
    this.#config = parsed.data;
    this.#fetch = dependencies.fetch ?? globalThis.fetch;
    this.#now = dependencies.now ?? (() => new Date());
  }

  get binding() { return bindingOf(this.#config); }

  async getAccount() {
    const result = await this.#get("", AccountResponseSchema);
    const { account, lastTransactionID } = result.value;
    if (account.id !== this.#config.accountId || account.currency !== this.#config.expectedCurrency) {
      throw new ReadError("ACCOUNT_MISMATCH");
    }
    const activePositions = account.positions.filter((p) =>
      compareDecimal(p.long.units, "0") !== 0 || compareDecimal(p.short.units, "0") !== 0);
    if (account.lastTransactionID !== lastTransactionID ||
        account.trades.length !== account.openTradeCount ||
        account.orders.length !== account.pendingOrderCount ||
        activePositions.length !== account.openPositionCount ||
        new Set(account.trades.map((t) => t.id)).size !== account.trades.length ||
        new Set(account.orders.map((o) => o.id)).size !== account.orders.length ||
        new Set(account.positions.map((p) => p.instrument)).size !== account.positions.length) {
      throw new ReadError("INVALID_RESPONSE");
    }
    return result;
  }

  async getInstruments() {
    const result = await this.#get("/instruments", InstrumentsResponseSchema, {
      instruments: this.#config.instruments.join(","),
    });
    this.#checkInstruments(result.value.instruments.map((item) => item.name));
    for (const item of result.value.instruments) {
      if (item.displayPrecision < -item.pipLocation ||
          compareDecimal(item.maximumOrderUnits, item.minimumTradeSize) < 0 ||
          compareDecimal(item.marginRate, "1") > 0) throw new ReadError("INVALID_RESPONSE");
    }
    return result;
  }

  async getPricing() {
    const result = await this.#get("/pricing", PricingResponseSchema, {
      instruments: this.#config.instruments.join(","), includeHomeConversions: "true",
    });
    this.#checkInstruments(result.value.prices.map((price) => price.instrument));
    if (new Set(result.value.homeConversions.map((c) => c.currency)).size !== result.value.homeConversions.length) {
      throw new ReadError("INVALID_RESPONSE");
    }
    return result;
  }

  async getTransactions(from: string, to: string) {
    if (!IdSchema.safeParse(from).success || !IdSchema.safeParse(to).success ||
        BigInt(from) > BigInt(to) || BigInt(to) - BigInt(from) >= 1000n) {
      throw new ReadError("CONFIG_INVALID");
    }
    const result = await this.#get("/transactions/idrange", TransactionsResponseSchema, { from, to });
    const ids = new Set<string>();
    for (const transaction of result.value.transactions) {
      if (transaction.accountID !== this.#config.accountId) throw new ReadError("ACCOUNT_MISMATCH");
      if (ids.has(transaction.id) || BigInt(transaction.id) < BigInt(from) || BigInt(transaction.id) > BigInt(to)) {
        throw new ReadError("INVALID_RESPONSE");
      }
      ids.add(transaction.id);
    }
    if (BigInt(result.value.lastTransactionID) < BigInt(to)) throw new ReadError("INVALID_RESPONSE");
    return result;
  }

  #checkInstruments(actual: string[]) {
    const expected = this.#config.instruments;
    if (actual.length !== expected.length || new Set(actual).size !== actual.length ||
        actual.some((value) => !expected.some((item) => item === value))) {
      throw new ReadError("INVALID_RESPONSE");
    }
  }

  /** There is deliberately no public request(), URL, method or order API. */
  async #get<T extends z.ZodTypeAny>(suffix: string, schema: T, query: Record<string, string> = {}): Promise<Observed<z.infer<T>>> {
    const url = new URL(`${OANDA_PRACTICE_ENDPOINTS.rest}/v3/accounts/${this.#config.accountId}${suffix}`);
    url.search = new URLSearchParams(query).toString();
    const requestedAt = this.#now().toISOString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await this.#fetch(url, {
        method: "GET", redirect: "error", credentials: "omit", cache: "no-store",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.#config.token}`,
          Accept: "application/json", "Accept-Datetime-Format": "RFC3339",
        },
      });
      if (response.status !== 200) {
        await response.body?.cancel();
        throw new ReadError("HTTP_ERROR", response.status);
      }
      if (!response.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
        await response.body?.cancel();
        throw new ReadError("INVALID_RESPONSE");
      }
      if (!response.body) throw new ReadError("INVALID_RESPONSE");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_RESPONSE_BYTES) {
            controller.abort();
            throw new ReadError("RESPONSE_TOO_LARGE");
          }
          chunks.push(value);
        }
      } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
      let payload: unknown;
      try { payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))); }
      catch { throw new ReadError("INVALID_RESPONSE"); }
      const parsed = schema.safeParse(payload);
      if (!parsed.success) throw new ReadError("INVALID_RESPONSE");
      return { requestedAt, receivedAt: this.#now().toISOString(), value: parsed.data };
    } catch (error) {
      if (error instanceof ReadError) throw error;
      throw new ReadError("TRANSPORT_ERROR");
    } finally {
      clearTimeout(timeout);
    }
  }
}
