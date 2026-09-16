import { mkdtemp, readFile, writeFile, readdir, rm, stat, chmod, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ObservationJournal } from "../src/journal.js";
import { bindingOf } from "../src/config.js";
import { config, snapshot, transactions, observe } from "./fixtures.js";

let directory: string;
const journals: ObservationJournal[] = [];
const binding = bindingOf(config);
async function open() {
  const journal = await ObservationJournal.open(directory, binding);
  journals.push(journal);
  return journal;
}
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), "trading-pod-journal-")); });
afterEach(async () => {
  for (const journal of journals.splice(0)) await journal.close();
  await rm(directory, { recursive: true, force: true });
});

describe("durable account-bound observations", () => {
  it("rejects observations outside the archive's declared universe", async () => {
    const journal = await open();
    const payload = snapshot();
    if (payload.kind === "transactions") throw new Error("wrong fixture");
    payload.pricing.value.prices[0].instrument = "GBP_USD";
    await expect(journal.append(payload)).rejects.toThrow("JOURNAL_INVALID");
    expect(journal.checkpoint).toBeNull();
  });
  it("persists payload and checkpoint together with restrictive file permissions", async () => {
    const journal = await open();
    await journal.append(snapshot());
    await journal.append({ kind: "transactions", from: "101", to: "102", response: observe(transactions(["101", "102"], "110")) });
    const file = join(directory, "000000000002.json");
    const envelope = JSON.parse(await readFile(file, "utf8"));
    expect(envelope.body.checkpoint).toBe("102");
    expect(envelope.body.payload.response.value.lastTransactionID).toBe("110");
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect(await readFile(file, "utf8")).not.toContain(config.token);
    await journal.close();
    expect((await open()).checkpoint).toBe("102");
  });

  it("refuses a second collector and never guesses that an old lock is stale", async () => {
    const journal = await open();
    await expect(open()).rejects.toThrow("JOURNAL_LOCKED");
    await journal.close();
    await writeFile(join(directory, "collector.lock"), '{"pid":9999999}', { mode: 0o600 });
    await expect(open()).rejects.toThrow("JOURNAL_LOCKED");
  });

  it("removes an interrupted uncommitted write only after replay, then resumes", async () => {
    const journal = await open(); await journal.append(snapshot()); await journal.close();
    await writeFile(join(directory, ".pending"), '{"incomplete":', { mode: 0o600 });
    const resumed = await open();
    expect(resumed.checkpoint).toBe("100");
    expect(await readdir(directory)).not.toContain(".pending");
    await resumed.append({ kind: "transactions", from: "101", to: "101", response: observe(transactions(["101"])) });
    expect(resumed.checkpoint).toBe("101");
  });

  it("does not advance after a failed disk rename and requires replay before more writes", async () => {
    const journal = await open(); await journal.append(snapshot());
    const obstruction = join(directory, "000000000002.json");
    await mkdir(obstruction);
    const payload = { kind: "transactions" as const, from: "101", to: "101", response: observe(transactions(["101"])) };
    await expect(journal.append(payload)).rejects.toThrow("JOURNAL_IO");
    expect(journal.checkpoint).toBe("100");
    await expect(journal.append(payload)).rejects.toThrow("JOURNAL_IO");
    await journal.close(); await rm(obstruction, { recursive: true });
    const resumed = await open(); expect(resumed.checkpoint).toBe("100");
    await resumed.append(payload); expect(resumed.checkpoint).toBe("101");
  });

  it.each(["truncated", "tampered", "missingRecord", "broadPermissions"])("refuses %s committed history", async (kind) => {
    const journal = await open();
    await journal.append(snapshot()); await journal.append(snapshot("100", "snapshot")); await journal.close();
    const file = join(directory, "000000000001.json");
    if (kind === "truncated") await writeFile(file, "{");
    if (kind === "tampered") await writeFile(file, (await readFile(file, "utf8")).replace('"10000.0000"', '"99999.0000"'));
    if (kind === "missingRecord") await rm(file);
    if (kind === "broadPermissions") await chmod(file, 0o644);
    await expect(open()).rejects.toThrow("JOURNAL_INVALID");
  });

  it.each(["account", "currency", "universe"])("cannot reuse history for another %s", async (kind) => {
    const journal = await open(); await journal.append(snapshot()); await journal.close();
    const changed = { ...binding };
    if (kind === "account") changed.accountId = "001-001-7654321-001";
    if (kind === "currency") changed.expectedCurrency = "USD";
    if (kind === "universe") changed.instruments = ["GBP_USD"];
    await expect(ObservationJournal.open(directory, changed)).rejects.toThrow("JOURNAL_INVALID");
  });

  it("refuses a snapshot that skips unrecorded transactions", async () => {
    const journal = await open(); await journal.append(snapshot());
    await expect(journal.append(snapshot("102", "snapshot"))).rejects.toThrow("JOURNAL_INVALID");
    expect(journal.checkpoint).toBe("100");
  });
  it("refuses a transaction page with a missing range before it", async () => {
    const journal = await open(); await journal.append(snapshot());
    await expect(journal.append({ kind: "transactions", from: "102", to: "102", response: observe(transactions(["102"])) })).rejects.toThrow("JOURNAL_INVALID");
  });
  it("rejects concurrent appends without corrupting the committed sequence", async () => {
    const journal = await open();
    const first = journal.append(snapshot());
    await expect(journal.append(snapshot())).rejects.toThrow("JOURNAL_IO");
    await first; await journal.close();
    expect((await open()).checkpoint).toBe("100");
  });
  it("rejects publicly readable observation directories", async () => {
    await chmod(directory, 0o755);
    await expect(open()).rejects.toThrow("JOURNAL_INVALID");
  });
});
