# UK Tax Model

## Applicable Tax Rules

Trading-Pod operates in two distinct UK tax regimes:

### FX Spread Betting (IG) — TAX-FREE

- Spread bets are classified as **gambling** by HMRC
- Profits are **not subject to CGT or Income Tax**
- No tax reporting requirement
- This is the primary advantage of using IG for FX

### Crypto Spot Trading (Kraken) — CGT APPLIES

- Crypto is a **chargeable asset** for Capital Gains Tax
- Current CGT rate for higher/additional rate taxpayers: **24%**
- Annual Exempt Amount: **£3,000** (from 2024/25 onwards, reduced from £6,000)
- UK tax year: **6 April – 5 April**

## How the Tax Collector Works

1. When a crypto spot trade closes **in profit**, the Tax Collector always records the gross profit to a running cumulative total (`totalGrossProfit`).

2. Whether tax is reserved depends on the `useAnnualExempt` setting:

### `useAnnualExempt: true` (default) — Cumulative Threshold Mode

- All profits are recorded but **no CGT is reserved** until cumulative gross profits exceed the annual exempt amount (£3,000).
- Once the threshold is crossed, only the portion above the threshold is taxed for the crossing trade; all subsequent profits are fully taxable.
- This is the recommended mode for most users.

### `useAnnualExempt: false` — Tax Every Trade Mode

- The annual exempt amount is ignored entirely.
- 24% CGT reserve is taken from **every** profitable crypto trade immediately.
- Useful if you have other capital gains outside Trading-Pod and have already used your allowance.

3. In both modes:
   - Reserve amount stored in D1 database
   - `TaxReservedEvent` emitted
   - The reserve is an **approximation** — actual CGT calculation may differ
   - HMRC requires Section 104 pool / same-day & 30-day matching rules
   - Year-end reconciliation should use proper tax software (Koinly, CoinTracker, etc.)

## Annual Exempt Amount Logic

### With `useAnnualExempt: true` (cumulative threshold)

```
£3,000 annual exempt amount per tax year

All profits recorded — tax only starts once cumulative gains exceed £3,000

Example:
  Trade 1: £1,000 profit → cumTotal £1,000 ≤ £3,000 → £0 reserved
  Trade 2: £1,500 profit → cumTotal £2,500 ≤ £3,000 → £0 reserved
  Trade 3: £1,200 profit → cumTotal £3,700 — crosses threshold
           → taxable = £3,700 − £3,000 = £700 → £168 reserved
  Trade 4: £800 profit  → cumTotal £4,500 → fully taxable → £192 reserved
```

### With `useAnnualExempt: false` (every trade taxed)

```
No exempt amount applied — every profit taxed immediately at 24%

Example:
  Trade 1: £1,000 profit → £240 reserved
  Trade 2: £1,500 profit → £360 reserved
  Trade 3: £1,200 profit → £288 reserved
```

## Tax Year Detection

The system automatically detects the current UK tax year:

- Dates from 6 April to 5 April next year = one tax year
- e.g., 15 March 2026 → tax year "2025/26"
- e.g., 10 April 2026 → tax year "2026/27"
- Annual exempt resets at the start of each new tax year

## Important Limitations

1. **This is NOT tax advice** — consult a qualified UK tax adviser
2. The reserve is a **cash-flow buffer**, not a precise tax calculation
3. Losses on crypto trades can potentially offset gains — not currently modelled
4. Crypto-to-crypto swaps are taxable disposals — not applicable here (we only trade crypto/GBP)
5. If you are a basic rate taxpayer, CGT rate is 10% not 24% — adjust `reserveRate` in config

## Configuration

In KV store under `config:tax`:
```json
{
  "reserveRate": 0.24,
  "annualExemptAmount": 3000,
  "useAnnualExempt": true
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `reserveRate` | number | 0.24 | CGT reserve rate (24% for higher-rate taxpayers) |
| `annualExemptAmount` | number | 3000 | Annual exempt amount in GBP |
| `useAnnualExempt` | boolean | true | Whether to apply the cumulative threshold before taxing |

## USD → GBP Currency Conversion

Crypto spot profits from Kraken are denominated in GBP pairs (e.g., `XBTGBP`), but if you trade USD pairs, the `CurrencyConverter` class handles conversion:

- Fetches live GBP/USD rate from Kraken’s public ticker API (`/0/public/Ticker?pair=GBPUSD`)
- Rate is cached with a configurable refresh interval (default: 60 seconds)
- If the API is unavailable, a fallback rate of 0.79 is used
- Conversion is applied **before** the Tax Collector calculates the CGT reserve

```typescript
const converter = new CurrencyConverter();
const gbpProfit = await converter.usdToGbp(usdProfit);
```

This ensures UK CGT reserves are calculated on the correct GBP amount regardless of the trading pair's quote currency.
