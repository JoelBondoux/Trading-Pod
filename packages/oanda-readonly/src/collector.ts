import { OandaReadOnlyClient } from "./client.js";
import { ObservationJournal } from "./journal.js";
import { ReadError } from "./errors.js";
import { assessExposure, assessPrices } from "./quality.js";

const MAX_PAGES_PER_POLL = 10;

export class ReadOnlyCollector {
  #polling = false;
  constructor(private readonly client: OandaReadOnlyClient, private readonly journal: ObservationJournal) {
    if (!journal.matchesBinding(client.binding)) throw new ReadError("CONFIG_INVALID");
  }

  async poll() {
    if (this.#polling) throw new ReadError("JOURNAL_IO");
    this.#polling = true;
    try { return await this.#poll(); }
    finally { this.#polling = false; }
  }

  async #poll() {
    const account = await this.client.getAccount();
    const target = account.value.lastTransactionID;
    const initialCheckpoint = this.journal.checkpoint;
    if (initialCheckpoint !== null && BigInt(target) < BigInt(initialCheckpoint)) {
      throw new ReadError("CHECKPOINT_REGRESSION");
    }
    let transactionsCollected = 0;
    let pages = 0;
    while (this.journal.checkpoint !== null && BigInt(this.journal.checkpoint) < BigInt(target) && pages < MAX_PAGES_PER_POLL) {
      const from = BigInt(this.journal.checkpoint) + 1n;
      const to = from + 999n < BigInt(target) ? from + 999n : BigInt(target);
      const response = await this.client.getTransactions(from.toString(), to.toString());
      // The account snapshot establishes that this specific final ID exists.
      if (to === BigInt(target) && !response.value.transactions.some((t) => t.id === target)) {
        throw new ReadError("INVALID_RESPONSE");
      }
      await this.journal.append({ kind: "transactions", from: from.toString(), to: to.toString(), response });
      transactionsCollected += response.value.transactions.length;
      pages++;
    }
    if (this.journal.checkpoint !== null && this.journal.checkpoint !== target) {
      return { readOnly: true, executionEnabled: false, catchUpPending: true, transactionsCollected,
        checkpoint: this.journal.checkpoint, snapshotRecorded: false } as const;
    }
    const instruments = await this.client.getInstruments();
    const pricing = await this.client.getPricing();
    await this.journal.append({ kind: initialCheckpoint === null ? "baseline" : "snapshot", account, instruments, pricing });
    return {
      readOnly: true, executionEnabled: false, catchUpPending: false, snapshotRecorded: true,
      baselineCreated: initialCheckpoint === null, transactionsCollected, checkpoint: this.journal.checkpoint,
      receivedAt: pricing.receivedAt, quotes: assessPrices(pricing),
      exposure: assessExposure(account.value.account, this.client.binding),
    } as const;
  }
}
