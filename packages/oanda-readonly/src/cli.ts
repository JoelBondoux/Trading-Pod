import { setTimeout as delay } from "node:timers/promises";
import { readConfig } from "./config.js";
import { OandaReadOnlyClient } from "./client.js";
import { ObservationJournal } from "./journal.js";
import { ReadOnlyCollector } from "./collector.js";
import { ReadError } from "./errors.js";

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") {
    console.log("OANDA practice observation collector: --once (default) | --watch\nSetup: docs/oanda_observer.md. GET requests only; execution remains locked.");
    return;
  }
  if (args.length > 1 || (args.length === 1 && !["--once", "--watch"].includes(args[0]))) {
    throw new ReadError("CONFIG_INVALID");
  }
  const config = readConfig(process.env);
  const client = new OandaReadOnlyClient(config.connection);
  const journal = await ObservationJournal.open(config.observationDir, client.binding);
  const collector = new ReadOnlyCollector(client, journal);
  const stop = new AbortController();
  const onSignal = () => stop.abort();
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  let failures = 0;
  try {
    do {
      let waitMs = config.pollIntervalMs;
      try {
        console.log(JSON.stringify(await collector.poll()));
        failures = 0;
      } catch (error) {
        if (args[0] !== "--watch" || !(error instanceof ReadError) || !error.retryable) throw error;
        failures++;
        waitMs = Math.min(60000, Math.max(config.pollIntervalMs, 5000) * 2 ** Math.min(failures - 1, 4));
        console.error(JSON.stringify({ code: error.code, status: error.status, retryInMs: waitMs, executionEnabled: false }));
      }
      if (args[0] !== "--watch" || stop.signal.aborted) break;
      await delay(waitMs, undefined, { signal: stop.signal }).catch(() => undefined);
    } while (!stop.signal.aborted);
  } finally {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    await journal.close();
  }
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ code: error instanceof ReadError ? error.code : "COLLECTOR_FAILED", executionEnabled: false }));
  process.exitCode = 1;
});
