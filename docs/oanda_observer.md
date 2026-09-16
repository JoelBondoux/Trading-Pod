# Read-only OANDA practice collector

The `@trading-pod/oanda-readonly` package is a runnable, server-side observation collector. It issues **GET requests only**, to the fixed OANDA practice REST host. It records account snapshots, eligible FX instrument metadata, bid/ask prices, home-currency conversions and subsequent account transactions. It has no order API and cannot unlock execution or update dashboard broker status.

This is the first P2 slice. It is tested with synthetic broker responses; no actual account has been connected. The local journal is an observation archive, not the planned PostgreSQL operational ledger. Streaming, account-state reducers, order ownership, risk reservations and trade lifecycle reconciliation remain to be built.

## Configure privately

The user has confirmed an OANDA v20 account. Obtain its **practice** account ID, actual account currency and a personal access token through OANDA's account management. Tokens may authorise more than read access or one account, so keep them only on the collector host. Never provide them through chat, a browser build, a signal or git.

Build from the repository root using Node 20.19+ and the pinned pnpm:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm -r build
cp packages/oanda-readonly/.env.example packages/oanda-readonly/.env
chmod 600 packages/oanda-readonly/.env
```

Edit the ignored `.env` securely on that host, or inject the same values using its secret manager. The collector never prints the configuration.

| Variable | Required value / default |
| --- | --- |
| `OANDA_ENVIRONMENT` | Literal `practice`; required |
| `OANDA_ACCOUNT_ID` | Exact v20 practice account ID; required |
| `OANDA_EXPECTED_CURRENCY` | Actual account home currency; required. The template's GBP is an example, not an assumption about the account |
| `OANDA_API_TOKEN` | Personal access token; required secret |
| `OANDA_FX_INSTRUMENTS` | Comma-separated canonical names; defaults to `EUR_USD`. Only `EUR_USD`, `GBP_USD`, `USD_JPY` are accepted |
| `OANDA_OBSERVATION_DIR` | Absolute private local directory; required, preferably outside the checkout |
| `OANDA_POLL_INTERVAL_MS` | Defaults to `5000`; integer from `1000` to `60000` |

The collector creates its directory with mode 0700 and files with mode 0600. It refuses a directory readable by other users, or a symlink at the configured directory. Use a local Linux filesystem with atomic rename and file/directory fsync; network filesystems and Windows are not verified. Provision encrypted durable storage and backups before a hosted soak. The archive contains private account and transaction details, although no API token.

`OANDA_BASE_URL`, `OANDA_REST_URL` and `OANDA_STREAM_URL` are refused. There is no live or custom host setting. The client rejects redirects, limits responses to 8 MiB and applies a ten-second timeout through body consumption. Upstream errors produce fixed codes, never raw response bodies or credential-bearing exceptions.

## Run

From the repository root, after filling the ignored `.env`:

```bash
node --env-file=packages/oanda-readonly/.env packages/oanda-readonly/dist/cli.mjs --once
```

Review the JSON summary for `snapshotRecorded`, `baselineCreated`, `catchUpPending`, quote-quality reasons and existing exposure. It always reports `executionEnabled: false`. A successful collection with stale or non-tradeable prices is still recorded, with `usableAtObservation: false`; it is not evidence of an executable signal. Closeout prices never substitute for executable bid/ask liquidity.

To collect continuously in a foreground process:

```bash
node --env-file=packages/oanda-readonly/.env packages/oanda-readonly/dist/cli.mjs --watch
```

With environment variables already injected, `corepack pnpm --filter @trading-pod/oanda-readonly collect` or `watch` runs the same CLI. No command reads a `.env` implicitly. `--help` requires no credentials.

Watch mode runs one poll at a time. Transport failures, HTTP 429 and HTTP 5xx retry with increasing delays from at least five seconds up to one minute. Authentication, validation, identity, checkpoint and storage failures stop the process with a nonzero exit. It does not report an old successful snapshot as current during an outage. SIGINT/SIGTERM allows the active bounded poll to finish, releases the directory lock, and exits. Allow up to three minutes for graceful shutdown during maximum catch-up. There is no deployed daemon, supervisor, alert delivery or retention job yet.

## Checkpoint semantics and recovery

1. The first successful collection stores a `baseline` account snapshot and its last transaction ID. **Transactions before this baseline are not collected.** No historical performance is inferred from it.
2. Later polls get a fresh account snapshot and collect transaction ranges from the stored checkpoint through that snapshot's last transaction ID. Each request covers at most 1,000 IDs, with no transaction-type filter. Non-FX account events and unknown transaction types are retained as evidence, never treated as permission to trade them.
3. Each completed range is saved before its checkpoint advances. The archive uses the requested range end; the response's `lastTransactionID` can be newer and is not used to skip ahead. IDs use exact integer comparisons without assuming contiguous IDs. The known final snapshot transaction must be present.
4. A poll collects at most ten ranges. If more remain, it returns `catchUpPending: true` without attaching the future account snapshot to an earlier checkpoint. Watch mode continues on its next cycle; repeat `--once` until catch-up finishes if running manually.
5. A complete snapshot records each request's start/receipt times alongside the broker's source times. Account, metadata and prices are separate requests, not a simultaneous market/account snapshot. Decimal amounts and nanosecond source timestamps remain strings.

Every numbered record includes its payload, checkpoint, account/currency/universe binding, sequence and previous-record hash. The collector writes and fsyncs a private temporary file, atomically renames it, fsyncs the directory, then advances its in-memory cursor. Restart replays the committed chain before making broker requests. It fails on mismatched identity, changed universe, malformed records, altered hashes or missing intermediate records. Hashes detect accidental corruption, not malicious rewriting or deletion of the archive's final records. This is not an authenticated or tamper-proof ledger.

The exclusive `collector.lock` prevents concurrent writers. A normal stop removes it. **A hard crash leaves the lock in place:** verify that the owning process is gone and no other collector uses the directory, back up the archive, then remove only `collector.lock` before restarting. The recorded PID/start time helps diagnosis; the program never assumes a PID is stale. It automatically discards only an uncommitted `.pending` file after successfully validating committed history. Do not edit numbered records or manually change checkpoints to bypass an error.

Storage stops at 1 GiB or 100,000 committed records, whichever comes first (`JOURNAL_FULL`). Automatic rotation is not implemented. Monitor disk use during commissioning and stop before the limit. Preserve the complete directory for future migration; starting a fresh directory creates a new explicitly prospective baseline and does not continue transaction history. Changing account, currency or instrument set also needs a distinct archive.

Existing trades, pending orders and both sides of hedged positions are flagged for review. Zero-unit historical positions are harmless observations. No collector operation closes, changes or claims ownership of existing trades. Full economic reconciliation against a transactional ledger is still a gate before practice writes.

## Validation and sources

Fixture and filesystem tests cover fixed-host GET-only requests, account/currency mismatches, FX metadata, precision-preserving data, stale/closed/illiquid quotes, missing conversions, large transaction IDs, bounded catch-up, redacted errors, response limits/timeouts, disk failure, concurrent writers, restart replay and corrupted history. Actual OANDA access and hosted restart/soak verification remain outstanding.

The implementation uses OANDA's official [account endpoints](https://developer.oanda.com/rest-live-v20/account-ep/), [pricing endpoints](https://developer.oanda.com/rest-live-v20/pricing-ep/), [pricing definitions](https://developer.oanda.com/rest-live-v20/pricing-df/) and [transaction endpoints](https://developer.oanda.com/rest-live-v20/transaction-ep/). Account-state polling/reducer work will follow the [best-practices guide](https://developer.oanda.com/rest-live-v20/best-practices/). Credentials follow the [authentication guidance](https://developer.oanda.com/rest-live-v20/authentication/).
