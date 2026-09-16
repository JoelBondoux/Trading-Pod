# OANDA practice setup

OANDA v20 practice is the selected broker target; the user has confirmed v20 account access. **A standalone read-only collector is implemented, but no actual account is configured or connected.** The dashboard and locked workers do not need broker credentials.

## Fixed environment

The shared contract defines only:

- REST: `https://api-fxpractice.oanda.com`
- Streaming: `https://stream-fxpractice.oanda.com`

These are OANDA's documented practice environments ([official introduction](https://developer.oanda.com/rest-live-v20/introduction/)). The new `@trading-pod/oanda-readonly` client uses only the REST host, only GET requests, and rejects redirects and custom host settings. Streaming is not implemented yet. It does not implement the historical broker execution interface. That older adapter still requires literal `demo: true`, has no working order/cancel methods and reports health false.

The old broker-selection function is restricted to offline mock FX simulation. Non-paper modes throw without falling back to a mock. IG and Capital.com are not selectable; their historical stubs cannot construct a live configuration.

## Read-only commissioning

Follow the [collector runbook](oanda_observer.md) and its ignored environment template. Configure a dedicated practice account/token, expected account currency, initial EUR_USD universe and a private observation directory. Never paste tokens into chat, commit them, or expose them through Vite.

The client validates account identity/currency, instrument metadata and numeric envelopes. It records account snapshots, prices, conversions and unfiltered transaction ranges with durable checkpoints. Stale, closed, illiquid or unconvertible prices are marked unusable; they never become execution instructions. Existing exposure is flagged, without modifying it.

Before the next stage, verify actual account connectivity and a hosted restart/catch-up soak. The local archive is not the planned transactional operational ledger; state reducers and economic reconciliation still need implementation before orders.

No API token is assumed to be scoped only to demo or reads; the client and deployment must enforce the permitted host and operations. Follow [OANDA authentication guidance](https://developer.oanda.com/rest-live-v20/authentication/).

## Initial universe

EUR_USD, GBP_USD and USD_JPY are the code allowlist; the collector defaults to EUR_USD. The API supplies account currency, instrument precision/minimum size and pricing conversion factors. Unsupported requested pairs, metals, crypto and equities are rejected. Existing out-of-universe account positions and transactions are preserved and flagged as observations so reconciliation does not hide them.

Do not enable order writes until atomic risk reservations, durable intents, idempotency/unknown-outcome handling, broker protection and full transaction reconciliation have passed their acceptance tests.
