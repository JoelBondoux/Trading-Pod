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

1. When a crypto spot trade closes **in profit**:
   - If annual exempt remaining > 0: deduct from exempt amount first
   - Apply 24% reserve rate on the taxable portion
   - Reserve amount stored in D1 database
   - `TaxReservedEvent` emitted

2. The reserve is an **approximation** — actual CGT calculation may differ:
   - HMRC requires Section 104 pool / same-day & 30-day matching rules
   - This system uses a simple flat 24% on each gain
   - Year-end reconciliation should use proper tax software (Koinly, CoinTracker, etc.)

## Annual Exempt Amount Logic

```
£3,000 annual exempt amount per tax year

First £3,000 of crypto gains → no tax reserved
Gains above £3,000 → 24% reserved on each additional gain

Example:
  Trade 1: £1,000 profit → £0 reserved (exempt remaining: £2,000)
  Trade 2: £2,500 profit → first £2,000 exempt, £500 taxable → £120 reserved
  Trade 3: £800 profit → fully taxable → £192 reserved
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
  "annualExemptAmount": 3000
}
```
