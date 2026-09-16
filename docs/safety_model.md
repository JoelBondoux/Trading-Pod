# Safety model

This foundation is **incapable of autonomous broker execution**. All modes report PAUSED, executionEnabled=false and brokerConnected=false. A mode name is not permission to trade.

## Enforced now

| Risk                                 | Boundary                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------- |
| Legacy live flag                     | Unknown/old mode values become LIVE_LOCKED; there is no live enable switch |
| Unsupported asset                    | Narrow FX schemas at FC, webhook and capital ingress                       |
| Empty/mixed signal batch             | Entire batch refused; no partial processing                                |
| Unpaused legacy KV value             | Lock ignores KV and cannot be resumed                                      |
| Placeholder capital                  | approved=false, allocatedAmount=0, HTTP 503                                |
| Fabricated capital return completion | processed=false, HTTP 503                                                  |
| Broker selection fallback            | Non-paper routes throw; no silent replacement with simulated fills         |
| OANDA live/custom host               | Fixed practice constant; literal demo=true required; no endpoint override  |
| Browser trading controls             | Read-only identity/status API, no service secrets, controls unavailable    |
| Forged dashboard identity            | Server signature/claim/subject verification                                |

The inherited execution engine is only an offline simulator. It still has simplified sizing, fill and close assumptions and cannot be treated as a backtest or broker lifecycle. Its adapter constructor rejects non-mock names, its router requires a real mock instance, and FX signals are validated. Code with arbitrary process access is not sandboxed by these API checks; researchers will need a separate restricted runtime.

## Required before practice writes

- Durable order intents and risk reservations committed before submission.
- Account-currency sizing from loss at the stop, spread/cost buffers and valid conversion rates.
- Aggregate currency, correlated exposure, gross leverage, daily loss and drawdown checks.
- Actual fill confirmation and distinct broker order, trade and transaction identifiers.
- Attached stop/target submission followed by authoritative verification.
- Unknown submission outcomes reconciled without blind retry or risk release.
- Restart/reconnect starts paused and reconciles before arming.
- Partial fill, rejection, missing protection, duplicate event, stale feed and crash recovery tests.
- Independent risk policy unavailable to LLM modification.

## Proposed practice defaults (not active settings)

Start at 0.10% NAV risk per trade with a 0.25% ceiling, 0.50% aggregate open risk, 0.30% shared-currency risk, 2x gross leverage, up to three positions/one per pair and five entries per day. Proposed stop conditions are 1% daily NAV loss, 3% drawdown and three consecutive losses. No averaging down, stop widening or weekend positions. These must be reviewed, specified precisely and implemented before commissioning.

Ordinary stops can slip or gap; they are not guaranteed monetary loss caps.

## Live execution

There is no live adapter or activation procedure in this release. A future live proposal requires a separate policy/evidence review and explicit authorisation. Nothing in a strategy score, weekend report or AI response can unlock trading.
