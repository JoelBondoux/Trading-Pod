import { afterEach, describe, expect, it, vi } from "vitest";
import { OandaReadOnlyClient } from "../src/client.js";
import { readConfig } from "../src/config.js";
import { config, account, instruments, pricing, transactions, transport, time, json } from "./fixtures.js";

const client = (fetch: typeof globalThis.fetch) => new OandaReadOnlyClient(config, { fetch, now: () => new Date(time) });
afterEach(() => vi.useRealTimers());

describe("practice-only configuration and egress", () => {
  it("sends only fixed-host GETs with redirects refused and credentials outside URLs", async () => {
    const fetch = transport(account(), instruments(), pricing(), transactions(["101"]));
    const api = client(fetch);
    await api.getAccount(); await api.getInstruments(); await api.getPricing(); await api.getTransactions("101", "101");
    expect(fetch).toHaveBeenCalledTimes(4);
    for (const [url, options] of fetch.mock.calls) {
      expect((url as URL).origin).toBe("https://api-fxpractice.oanda.com");
      expect(String(url)).not.toContain(config.token);
      expect(options).toMatchObject({ method: "GET", redirect: "error", credentials: "omit", cache: "no-store" });
      expect(options?.body).toBeUndefined();
      expect(options?.headers).toMatchObject({ Authorization: `Bearer ${config.token}`, "Accept-Datetime-Format": "RFC3339" });
    }
    expect(String(fetch.mock.calls[2][0])).toContain("includeHomeConversions=true");
    expect(String(fetch.mock.calls[3][0])).toContain("from=101&to=101");
    expect(JSON.stringify(api)).not.toContain(config.token);
  });

  it.each([
    { environment: "live" }, { environment: undefined }, { instruments: ["XAU_USD"] },
    { instruments: ["EUR/USD"] }, { instruments: ["EUR_USD", "EUR_USD"] },
    { accountId: "../other" }, { token: "bad\r\nheader" }, { baseUrl: "https://example.com" },
  ])("refuses unsafe config before any request: %j", (patch) => {
    const fetch = vi.fn();
    expect(() => new OandaReadOnlyClient({ ...config, ...patch } as never, { fetch })).toThrow("CONFIG_INVALID");
    expect(fetch).not.toHaveBeenCalled();
  });

  const env = {
    OANDA_ENVIRONMENT: "practice", OANDA_ACCOUNT_ID: config.accountId, OANDA_EXPECTED_CURRENCY: "GBP",
    OANDA_API_TOKEN: config.token, OANDA_OBSERVATION_DIR: "/private/observations",
  };
  it("defaults to EUR_USD and a five-second poll without logging credentials", () => {
    expect(readConfig(env)).toMatchObject({ pollIntervalMs: 5000, connection: { instruments: ["EUR_USD"] } });
  });
  it.each([
    { OANDA_BASE_URL: "https://example.com" }, { OANDA_REST_URL: "" },
    { OANDA_STREAM_URL: "https://example.com" }, { OANDA_OBSERVATION_DIR: "relative" },
    { OANDA_EXPECTED_CURRENCY: undefined }, { OANDA_POLL_INTERVAL_MS: "10" },
    { OANDA_POLL_INTERVAL_MS: "5000oops" }, { OANDA_POLL_INTERVAL_MS: "60001" },
  ])("refuses ambiguous environment: %j", (patch) => {
    expect(() => readConfig({ ...env, ...patch })).toThrow("CONFIG_INVALID");
  });
});

describe("broker response validation", () => {
  it("preserves exact decimal strings and nanosecond source times", async () => {
    const prices = pricing(); prices.prices[0].time = "2026-09-16T10:00:00.123456789Z";
    expect((await client(transport(account())).getAccount()).value.account.balance).toBe("10000.0000");
    expect((await client(transport(prices)).getPricing()).value.prices[0].time).toBe(prices.prices[0].time);
  });
  it.each(["id", "currency"] as const)("rejects account %s mismatch", async (key) => {
    const data = account(); data.account[key] = key === "id" ? "001-001-7654321-001" : "USD";
    await expect(client(transport(data)).getAccount()).rejects.toThrow("ACCOUNT_MISMATCH");
  });
  it.each(["NAV", "balance", "marginAvailable"] as const)("rejects non-finite %s", async (key) => {
    const data = account(); data.account[key] = "NaN";
    await expect(client(transport(data)).getAccount()).rejects.toThrow("INVALID_RESPONSE");
  });
  it("rejects inconsistent snapshot cursor and position counts", async () => {
    const data = account(); data.account.lastTransactionID = "99";
    await expect(client(transport(data)).getAccount()).rejects.toThrow("INVALID_RESPONSE");
    const counts = account(); counts.account.openTradeCount = 1;
    await expect(client(transport(counts)).getAccount()).rejects.toThrow("INVALID_RESPONSE");
  });
  it.each(["missing", "duplicate", "wrongType", "badPrecision", "badSize"])("rejects %s instrument metadata", async (kind) => {
    const data = instruments();
    if (kind === "missing") data.instruments = [];
    if (kind === "duplicate") data.instruments.push(data.instruments[0]);
    if (kind === "wrongType") data.instruments[0].type = "METAL";
    if (kind === "badPrecision") data.instruments[0].displayPrecision = 3;
    if (kind === "badSize") data.instruments[0].maximumOrderUnits = "0.1";
    await expect(client(transport(data)).getInstruments()).rejects.toThrow("INVALID_RESPONSE");
  });
  it.each(["missing", "duplicate", "unknown", "badConversion", "duplicateConversion"])("rejects %s pricing data", async (kind) => {
    const data = pricing();
    if (kind === "missing") data.prices = [];
    if (kind === "duplicate") data.prices.push(data.prices[0]);
    if (kind === "unknown") data.prices[0].instrument = "GBP_USD";
    if (kind === "badConversion") data.homeConversions[0].accountLoss = "0";
    if (kind === "duplicateConversion") data.homeConversions.push(data.homeConversions[0]);
    await expect(client(transport(data)).getPricing()).rejects.toThrow("INVALID_RESPONSE");
  });
  it("preserves all transaction types and large IDs without conflating the range with latest account ID", async () => {
    const id = "9007199254740993";
    const data = transactions([id], "9007199254749999");
    data.transactions[0].type = "FUTURE_BROKER_EVENT";
    Object.assign(data.transactions[0], { instrument: "XAU_USD", nested: { raw: "preserved" } });
    const response = await client(transport(data)).getTransactions(id, id);
    expect(response.value).toEqual(data);
  });
  it.each(["duplicate", "outside", "wrongAccount", "regression"])("rejects %s transactions", async (kind) => {
    const data = transactions(["101"]);
    if (kind === "duplicate") data.transactions.push(data.transactions[0]);
    if (kind === "outside") data.transactions[0].id = "102";
    if (kind === "wrongAccount") data.transactions[0].accountID = "001-001-7654321-001";
    if (kind === "regression") data.lastTransactionID = "100";
    await expect(client(transport(data)).getTransactions("101", "101")).rejects.toThrow();
  });
  it("bounds transaction pages before sending a request", async () => {
    const fetch = vi.fn();
    await expect(client(fetch).getTransactions("1", "1001")).rejects.toThrow("CONFIG_INVALID");
    await expect(client(fetch).getTransactions("2", "1")).rejects.toThrow("CONFIG_INVALID");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("transport failures", () => {
  it.each([301, 401, 403, 416, 429, 503])("reports HTTP %s without leaking the response body", async (status) => {
    const error = await client(transport(json({ error: config.token }, status))).getAccount().catch((e) => e);
    expect(error).toMatchObject({ code: "HTTP_ERROR", status, retryable: status === 429 || status >= 500 });
    expect(String(error) + JSON.stringify(error)).not.toContain(config.token);
  });
  it("redacts underlying fetch errors", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error(config.token));
    const error = await client(fetch).getAccount().catch((e) => e);
    expect(error.code).toBe("TRANSPORT_ERROR");
    expect(JSON.stringify(error) + String(error)).not.toContain(config.token);
  });
  it("rejects malformed JSON and non-JSON responses", async () => {
    for (const response of [new Response("{oops", { headers: { "content-type": "application/json" } }), new Response("<html>oops</html>")]) {
      await expect(client(transport(response)).getAccount()).rejects.toThrow("INVALID_RESPONSE");
    }
  });
  it("caps the actual streamed body even without a Content-Length", async () => {
    const response = new Response("x".repeat(8 * 1024 * 1024 + 1), { headers: { "content-type": "application/json" } });
    await expect(client(transport(response)).getAccount()).rejects.toThrow("RESPONSE_TOO_LARGE");
  });
  it("aborts a stalled request after ten seconds", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (_url, init) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted")))));
    const pending = expect(client(fetch).getAccount()).rejects.toThrow("TRANSPORT_ERROR");
    await vi.advanceTimersByTimeAsync(10000);
    await pending;
  });
});
