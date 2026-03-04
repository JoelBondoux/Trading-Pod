# TradingView Setup

## Overview

TradingView sends **outbound webhook alerts** to Trading-Pod's webhook worker. There is no inbound API — TradingView is a one-way signal source.

## Requirements

- **TradingView Essential plan** (~$13/month) or higher — webhooks require a paid plan
- A deployed `webhook-worker` on Cloudflare

## Creating an Alert with Webhook

1. Open a chart on TradingView
2. Add your indicator or strategy
3. Click "Alerts" → "Create Alert"
4. Configure the condition (e.g., MA crossover)
5. Under "Notifications", enable **Webhook URL**
6. Set URL to: `https://webhook-worker.<your-subdomain>.workers.dev/webhook/tradingview`
7. Set the **Alert message** (JSON format — see below)

## Alert Message Format

The webhook body must be valid JSON matching our schema:

```json
{
  "secret": "your-webhook-secret",
  "ticker": "GBPUSD",
  "action": "buy",
  "price": 1.2650,
  "stopLoss": 1.2600,
  "takeProfit": 1.2750,
  "confidence": 0.75,
  "holdingTimeMinutes": 240,
  "justification": "MA 20/50 bullish crossover on 1H",
  "assetClass": "fx",
  "agentId": "tradingview_ma_cross"
}
```

### Field Reference

| Field | Required | Values |
|-------|----------|--------|
| `secret` | ✅ | Must match `config:webhook_secret` in KV |
| `ticker` | ✅ | Instrument identifier (e.g., `"GBPUSD"`, `"BTCUSD"`) |
| `action` | ✅ | `"buy"` or `"sell"` |
| `price` | ✅ | Current price at alert time |
| `stopLoss` | ✅ | Stop-loss level |
| `takeProfit` | ✅ | Take-profit level |
| `confidence` | ✅ | 0–1 confidence score |
| `holdingTimeMinutes` | ✅ | Suggested holding time |
| `justification` | ✅ | Human-readable reason |
| `assetClass` | ✅ | `"fx"` or `"crypto"` |
| `agentId` | ✅ | Unique ID for this TradingView strategy |

## TradingView Alert Variables

You can use TradingView placeholders in the message:

```json
{
  "secret": "your-secret",
  "ticker": "{{ticker}}",
  "action": "{{strategy.order.action}}",
  "price": {{close}},
  "stopLoss": {{plot("SL")}},
  "takeProfit": {{plot("TP")}},
  "confidence": 0.7,
  "holdingTimeMinutes": 240,
  "justification": "{{strategy.order.comment}}",
  "assetClass": "fx",
  "agentId": "tv_custom_strategy"
}
```

## Security

### Webhook Secret
- Stored in Cloudflare KV under `config:webhook_secret`
- Must be included in every webhook payload
- If the secret doesn't match, the request is rejected with 401

### IP Whitelisting
The webhook worker validates the source IP against TradingView's known IPs:

```
52.89.214.238
34.212.75.30
54.218.53.128
52.32.178.7
```

⚠️ Note: These IPs may change. Check TradingView's documentation for current list.

### Timeout
TradingView webhooks timeout after **3 seconds**. The webhook worker immediately acknowledges the request and processes asynchronously.

## Testing

You can test the webhook manually:

```bash
curl -X POST https://webhook-worker.<your-subdomain>.workers.dev/webhook/tradingview \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "your-secret",
    "ticker": "GBPUSD",
    "action": "buy",
    "price": 1.2650,
    "stopLoss": 1.2600,
    "takeProfit": 1.2750,
    "confidence": 0.75,
    "holdingTimeMinutes": 240,
    "justification": "Test signal",
    "assetClass": "fx",
    "agentId": "test_agent"
  }'
```

Note: When testing locally, IP validation is bypassed.
