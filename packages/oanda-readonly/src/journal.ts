import { createHash } from "node:crypto";
import { open, mkdir, readdir, readFile, rename, unlink, lstat } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { BindingSchema, type Binding } from "./config.js";
import { ReadError } from "./errors.js";
import {
  AccountResponseSchema, InstrumentsResponseSchema, PricingResponseSchema,
  TransactionsResponseSchema, IdSchema, observedSchema,
} from "./schemas.js";

const PayloadSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.enum(["baseline", "snapshot"]),
    account: observedSchema(AccountResponseSchema),
    instruments: observedSchema(InstrumentsResponseSchema),
    pricing: observedSchema(PricingResponseSchema),
  }).strict(),
  z.object({
    kind: z.literal("transactions"), from: IdSchema, to: IdSchema,
    response: observedSchema(TransactionsResponseSchema),
  }).strict(),
]);
export type JournalPayload = z.infer<typeof PayloadSchema>;
const BodySchema = z.object({
  version: z.literal(1),
  sequence: z.number().int().positive().safe(),
  binding: BindingSchema,
  previousHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  previousCheckpoint: IdSchema.nullable(),
  checkpoint: IdSchema,
  payload: PayloadSchema,
}).strict();
const EnvelopeSchema = z.object({
  hash: z.string().regex(/^[a-f0-9]{64}$/), body: BodySchema,
}).strict();
const MAX_RECORD_BYTES = 32 * 1024 * 1024;
const MAX_JOURNAL_BYTES = 1024 * 1024 * 1024;
const MAX_RECORDS = 100000;
const digest = (body: unknown) => createHash("sha256").update(JSON.stringify(body)).digest("hex");
const fileName = (sequence: number) => `${String(sequence).padStart(12, "0")}.json`;

/** Local observation archive only. This is not the future execution/risk ledger. */
export class ObservationJournal {
  #sequence = 0;
  #hash: string | null = null;
  #checkpoint: string | null = null;
  #bytes = 0;
  #closed = false;
  #poisoned = false;
  #writing = false;

  private constructor(
    readonly directory: string,
    private readonly binding: Binding,
    private readonly lock: FileHandle,
  ) {}

  get checkpoint() { return this.#checkpoint; }

  matchesBinding(binding: Binding) {
    return JSON.stringify(this.binding) === JSON.stringify(binding);
  }

  static async open(directory: string, binding: Binding) {
    let journal: ObservationJournal | undefined;
    try {
      const parsedBinding = BindingSchema.safeParse(binding);
      if (!parsedBinding.success) throw new ReadError("CONFIG_INVALID");
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const directoryStat = await lstat(directory);
      if (!directoryStat.isDirectory() || (directoryStat.mode & 0o077) !== 0) throw new ReadError("JOURNAL_INVALID");
      let lock: FileHandle;
      try { lock = await open(join(directory, "collector.lock"), "wx", 0o600); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new ReadError("JOURNAL_LOCKED");
        throw error;
      }
      journal = new ObservationJournal(directory, parsedBinding.data, lock);
      await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }) + "\n");
      await lock.sync();
      await journal.#replay();
      // A crash before rename leaves this uncommitted record. Only remove it after
      // the complete committed chain has been validated under the exclusive lock.
      await unlink(join(directory, ".pending")).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
      return journal;
    } catch (error) {
      await journal?.close();
      if (error instanceof ReadError) throw error;
      throw new ReadError("JOURNAL_IO");
    }
  }

  async append(payload: JournalPayload) {
    if (this.#closed || this.#poisoned || this.#writing) throw new ReadError("JOURNAL_IO");
    this.#writing = true;
    try {
      const validated = PayloadSchema.safeParse(payload);
      if (!validated.success) throw new ReadError("JOURNAL_INVALID");
      const checkpoint = this.#nextCheckpoint(validated.data);
      const body: z.infer<typeof BodySchema> = {
        version: 1, sequence: this.#sequence + 1, binding: this.binding,
        previousHash: this.#hash, previousCheckpoint: this.#checkpoint,
        checkpoint, payload: validated.data,
      };
      const hash = digest(body);
      const content = JSON.stringify({ hash, body }) + "\n";
      const bytes = Buffer.byteLength(content);
      if (bytes > MAX_RECORD_BYTES) throw new ReadError("JOURNAL_INVALID");
      if (this.#bytes + bytes > MAX_JOURNAL_BYTES || this.#sequence >= MAX_RECORDS) throw new ReadError("JOURNAL_FULL");
      const pending = join(this.directory, ".pending");
      const file = await open(pending, "wx", 0o600);
      try { await file.writeFile(content); await file.sync(); }
      finally { await file.close(); }
      await rename(pending, join(this.directory, fileName(body.sequence)));
      const directory = await open(this.directory, "r");
      try { await directory.sync(); }
      finally { await directory.close(); }
      // Advance memory only after data + rename have been flushed to disk.
      this.#sequence = body.sequence;
      this.#bytes += bytes;
      this.#hash = hash;
      this.#checkpoint = checkpoint;
    } catch (error) {
      this.#poisoned = true; // Any uncertain disk result requires a fresh replay.
      if (error instanceof ReadError) throw error;
      throw new ReadError("JOURNAL_IO");
    } finally {
      this.#writing = false;
    }
  }

  async close() {
    if (this.#closed) return;
    if (this.#writing) throw new ReadError("JOURNAL_IO");
    this.#closed = true;
    try {
      await this.lock.close();
      await unlink(join(this.directory, "collector.lock"));
    } catch { throw new ReadError("JOURNAL_IO"); }
  }

  async #replay() {
    const names = (await readdir(this.directory)).sort();
    for (const name of names) {
      if (name === "collector.lock" || name === ".pending") continue;
      if (name !== fileName(this.#sequence + 1)) throw new ReadError("JOURNAL_INVALID");
      const path = join(this.directory, name);
      const stat = await lstat(path);
      if (!stat.isFile() || stat.size > MAX_RECORD_BYTES || (stat.mode & 0o077) !== 0) throw new ReadError("JOURNAL_INVALID");
      if (this.#bytes + stat.size > MAX_JOURNAL_BYTES || this.#sequence >= MAX_RECORDS) throw new ReadError("JOURNAL_FULL");
      let raw: unknown;
      try { raw = JSON.parse(await readFile(path, "utf8")); }
      catch { throw new ReadError("JOURNAL_INVALID"); }
      const parsed = EnvelopeSchema.safeParse(raw);
      if (!parsed.success) throw new ReadError("JOURNAL_INVALID");
      const { hash, body } = parsed.data;
      if (hash !== digest((raw as { body: unknown }).body) || body.sequence !== this.#sequence + 1 ||
          body.previousHash !== this.#hash || body.previousCheckpoint !== this.#checkpoint ||
          JSON.stringify(body.binding) !== JSON.stringify(this.binding) ||
          body.checkpoint !== this.#nextCheckpoint(body.payload)) throw new ReadError("JOURNAL_INVALID");
      this.#sequence = body.sequence;
      this.#bytes += stat.size;
      this.#hash = hash;
      this.#checkpoint = body.checkpoint;
    }
  }

  #nextCheckpoint(payload: JournalPayload): string {
    if (payload.kind !== "transactions") {
      const { account, lastTransactionID } = payload.account.value;
      if (account.id !== this.binding.accountId || account.currency !== this.binding.expectedCurrency ||
          account.lastTransactionID !== lastTransactionID ||
          (payload.kind === "baseline" ? this.#checkpoint !== null : lastTransactionID !== this.#checkpoint)) {
        throw new ReadError("JOURNAL_INVALID");
      }
      for (const names of [payload.instruments.value.instruments.map((item) => item.name),
        payload.pricing.value.prices.map((price) => price.instrument)]) {
        if (names.length !== this.binding.instruments.length || new Set(names).size !== names.length ||
            names.some((name) => !this.binding.instruments.includes(name))) throw new ReadError("JOURNAL_INVALID");
      }
      return lastTransactionID;
    }
    if (this.#checkpoint === null || BigInt(payload.from) !== BigInt(this.#checkpoint) + 1n ||
        BigInt(payload.to) < BigInt(payload.from) || BigInt(payload.to) - BigInt(payload.from) >= 1000n ||
        BigInt(payload.response.value.lastTransactionID) < BigInt(payload.to)) {
      throw new ReadError("JOURNAL_INVALID");
    }
    const ids = new Set<string>();
    for (const transaction of payload.response.value.transactions) {
      if (transaction.accountID !== this.binding.accountId || ids.has(transaction.id) ||
          BigInt(transaction.id) < BigInt(payload.from) || BigInt(transaction.id) > BigInt(payload.to)) {
        throw new ReadError("JOURNAL_INVALID");
      }
      ids.add(transaction.id);
    }
    // This is the covered range end, NOT response.lastTransactionID (which may be newer).
    return payload.to;
  }
}
