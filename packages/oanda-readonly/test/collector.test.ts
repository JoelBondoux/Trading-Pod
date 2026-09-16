import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OandaReadOnlyClient } from "../src/client.js";
import { ObservationJournal } from "../src/journal.js";
import { ReadOnlyCollector } from "../src/collector.js";
import { bindingOf } from "../src/config.js";
import { account, config, instruments, pricing, transactions, transport, time, snapshot, json } from "./fixtures.js";

let directory: string;
let journal: ObservationJournal;
const api = (fetch: typeof globalThis.fetch) => new OandaReadOnlyClient(config, { fetch, now: () => new Date(time) });
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "trading-pod-collector-"));
  journal = await ObservationJournal.open(directory, bindingOf(config));
});
afterEach(async () => { await journal.close(); await rm(directory, { recursive: true, force: true }); });

describe("prospective collection and catch-up", () => {
  it("refuses to combine a client and journal configured for different universes", () => {
    const fetch = vi.fn();
    const different = new OandaReadOnlyClient({ ...config, instruments: ["GBP_USD"] }, { fetch });
    expect(() => new ReadOnlyCollector(different, journal)).toThrow("CONFIG_INVALID");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("creates an explicit first-observation baseline, not fabricated historic performance", async () => {
    const fetch = transport(account(), instruments(), pricing());
    const result = await new ReadOnlyCollector(api(fetch), journal).poll();
    expect(result).toMatchObject({ baselineCreated: true, snapshotRecorded: true, checkpoint: "100", transactionsCollected: 0, executionEnabled: false });
    expect(fetch).toHaveBeenCalledTimes(3);
    const file = JSON.parse(await readFile(join(directory, "000000000001.json"), "utf8"));
    expect(file.body.payload.kind).toBe("baseline");
  });

  it("restarts from disk and records only the missing range, ignoring a newer response cursor", async () => {
    await journal.append(snapshot()); await journal.close();
    journal = await ObservationJournal.open(directory, bindingOf(config));
    const fetch = transport(account("102"), transactions(["101", "102"], "104"), instruments(), pricing());
    const collector = new ReadOnlyCollector(api(fetch), journal);
    expect(await collector.poll()).toMatchObject({ checkpoint: "102", transactionsCollected: 2, catchUpPending: false });
    expect(String(fetch.mock.calls[1][0])).toContain("from=101&to=102");
    const repeat = transport(account("102"), instruments(), pricing());
    expect(await new ReadOnlyCollector(api(repeat), journal).poll()).toMatchObject({ transactionsCollected: 0 });
    expect(repeat).toHaveBeenCalledTimes(3);
  });

  it("persists each bounded range so a failed later page can resume without duplicates", async () => {
    await journal.append(snapshot());
    const failed = transport(account("1200"), transactions(["1100"], "1200"), json({ message: "busy" }, 503));
    await expect(new ReadOnlyCollector(api(failed), journal).poll()).rejects.toMatchObject({ code: "HTTP_ERROR", status: 503 });
    expect(journal.checkpoint).toBe("1100");
    await journal.close(); journal = await ObservationJournal.open(directory, bindingOf(config));
    const retry = transport(account("1200"), transactions(["1200"]), instruments(), pricing());
    await new ReadOnlyCollector(api(retry), journal).poll();
    expect(String(retry.mock.calls[1][0])).toContain("from=1101&to=1200");
    expect(journal.checkpoint).toBe("1200");
  });

  it("does not assume IDs are contiguous or coerce large IDs to Number", async () => {
    await journal.append(snapshot("9007199254740993"));
    const fetch = transport(account("9007199254740996"), transactions(["9007199254740996"]), instruments(), pricing());
    await new ReadOnlyCollector(api(fetch), journal).poll();
    expect(String(fetch.mock.calls[1][0])).toContain("from=9007199254740994&to=9007199254740996");
    expect(journal.checkpoint).toBe("9007199254740996");
  });

  it("limits catch-up work per poll and does not attach a future snapshot to an earlier checkpoint", async () => {
    await journal.append(snapshot());
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (url) => {
      const address = new URL(String(url));
      if (address.pathname.endsWith("/transactions/idrange")) return json(transactions([address.searchParams.get("to")!], "12000"));
      return json(account("12000"));
    });
    expect(await new ReadOnlyCollector(api(fetch), journal).poll()).toMatchObject({ catchUpPending: true, snapshotRecorded: false, checkpoint: "10100" });
    expect(fetch).toHaveBeenCalledTimes(11);
  });

  it("rejects a broker checkpoint regression", async () => {
    await journal.append(snapshot());
    await expect(new ReadOnlyCollector(api(transport(account("99"))), journal).poll()).rejects.toThrow("CHECKPOINT_REGRESSION");
    expect(journal.checkpoint).toBe("100");
  });
  it("does not advance when the snapshot's known final transaction is absent", async () => {
    await journal.append(snapshot());
    await expect(new ReadOnlyCollector(api(transport(account("102"), transactions(["101"], "102"))), journal).poll()).rejects.toThrow("INVALID_RESPONSE");
    expect(journal.checkpoint).toBe("100");
  });
  it("retains weekend observations with unusable quotes and no trading permission", async () => {
    const prices = pricing(); prices.prices[0].tradeable = false; prices.prices[0].time = "2026-09-11T21:00:00Z";
    const result = await new ReadOnlyCollector(api(transport(account(), instruments(), prices)), journal).poll();
    expect(result.snapshotRecorded).toBe(true);
    expect(result.executionEnabled).toBe(false);
    expect(result.quotes?.[0]).toMatchObject({ usableAtObservation: false, reasons: ["STALE", "NOT_TRADEABLE"] });
  });
  it("does not create a baseline if metadata validation fails", async () => {
    const metadata = instruments(); metadata.instruments = [];
    await expect(new ReadOnlyCollector(api(transport(account(), metadata)), journal).poll()).rejects.toThrow("INVALID_RESPONSE");
    expect(journal.checkpoint).toBeNull();
  });
  it("prevents overlapping poll cycles", async () => {
    let release!: (response: Response) => void;
    const blocking = vi.fn<typeof globalThis.fetch>().mockImplementationOnce(async () => new Promise((resolve) => { release = resolve; }))
      .mockResolvedValueOnce(json(instruments())).mockResolvedValueOnce(json(pricing()));
    const collector = new ReadOnlyCollector(api(blocking), journal);
    const first = collector.poll();
    await expect(collector.poll()).rejects.toThrow("JOURNAL_IO");
    release(json(account())); await first;
  });
});
