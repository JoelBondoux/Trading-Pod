# TradingView ingress

TradingView is optional observational input. It is not the execution authority or account state.

The existing /webhook/tradingview endpoint now accepts only FX signals for EUR_USD, GBP_USD and USD_JPY. Explicit aliases such as EUR/USD and EURUSD are normalised. Exchange-prefixed symbols, unsupported currencies, metals, crypto and equities are rejected.

The legacy source-IP allowlist is enforced by default, including when the source header is absent. Payload-secret validation remains in legacy KV; migrate it to a secret store before commissioning the integration. Do not log or publish real webhook secrets.

A syntactically valid, authenticated webhook can be forwarded to FC, but FC returns 503 / accepted=false while locked. The wrapper reports forwarded=false; receipt does not mean approval, order submission or a fill.

No alert should be armed for autonomous execution in this milestone. Broker prices, transactions and confirmed protection will be authoritative. Future webhook ingestion requires replay protection, expiry, a durable queue and reconciliation; an alert cannot bypass risk policy.

[TradingView webhook documentation](https://www.tradingview.com/support/solutions/43000529348-how-to-configure-webhook-alerts/)
