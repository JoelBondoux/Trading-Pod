# OANDA practice setup

OANDA v20 practice is the selected broker target. **No account is connected and no broker credential is required by the current foundation.**

## Fixed environment

The shared contract defines only:

- REST: `https://api-fxpractice.oanda.com`
- Streaming: `https://stream-fxpractice.oanda.com`

These are OANDA's documented practice environments ([official introduction](https://developer.oanda.com/rest-live-v20/introduction/)). Live hosts and arbitrary base URL overrides are absent from the OANDA adapter. A constructor call with `demo` other than literal `true` throws. The adapter's order/cancel methods remain unimplemented and its health check returns false.

The old broker-selection function is restricted to offline mock FX simulation. Non-paper modes throw without falling back to a mock. IG and Capital.com are not selectable; their historical stubs cannot construct a live configuration.

## Next connection milestone

1. Configure a dedicated practice account and token in the execution service's secret store. Never paste tokens into chat, commit them, or expose them through Vite.
2. Validate account identity and currency against server configuration; never accept an account ID or URL from a signal.
3. Implement read-only account summary, eligible instrument metadata, prices and transaction checkpoints.
4. Reject redirects, stale prices, unavailable conversions and unresolved broker/account mismatches.
5. Record reconnect and reconciliation evidence before implementing order writes.

No API token is assumed to be scoped only to demo or reads; the client and deployment must enforce the permitted host and operations. Follow [OANDA authentication guidance](https://developer.oanda.com/rest-live-v20/authentication/).

## Initial universe

EUR_USD, GBP_USD and USD_JPY are the code allowlist; commissioning should begin with EUR_USD. Availability, precision, minimum size, account currency and conversion factors will be obtained from the account's own instrument metadata. Unsupported pairs, metals, crypto and equities are rejected.

Do not enable order writes until atomic risk reservations, durable intents, idempotency/unknown-outcome handling, broker protection and full transaction reconciliation have passed their acceptance tests.
