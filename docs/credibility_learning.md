# Credibility Learning

## Overview

Each signal agent has a credibility score ∈ [0.05, 1.0] that the Financial Controller uses to weight its signals during consensus computation. Agents that produce profitable trades gain credibility; agents that produce losing trades lose it.

## EMA Formula

Credibility is updated using Exponential Moving Average:

$$S_{new} = \alpha \cdot R + (1 - \alpha) \cdot S_{old}$$

Where:
- $S_{old}$ = previous credibility score
- $R$ = reward (1 for profitable trade, 0 for losing trade)
- $\alpha = 0.1$ (smoothing factor — balances responsiveness vs. stability)

### Why EMA?

- Simple to compute (no history buffer needed)
- Recent performance weighted more heavily
- Naturally bounded between 0 and 1
- Smooth transitions prevent one bad trade from destroying reputation

## Idle Decay

If an agent hasn't produced a scored signal for a while, its credibility decays:

$$S_{decayed} = S_{old} \cdot \lambda^{days}$$

- $\lambda = 0.997$ per day
- After 30 idle days: score ≈ 91% of original
- After 100 idle days: score ≈ 74% of original
- This prevents "stale" high scores from agents that stopped trading

## Consensus Computation

The FC computes weighted consensus:

1. Group signals by direction (long/short)
2. Sum credibility-weighted confidence for each direction:
   $$W_d = \sum_{i} S_i \cdot C_i$$
   where $S_i$ is credibility and $C_i$ is signal confidence
3. Winning direction = highest weighted sum
4. Consensus confidence = $\frac{W_{winner}}{W_{total}}$

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `alpha` | 0.1 | EMA smoothing factor |
| `idleDecayLambda` | 0.997 | Daily decay rate |
| `initialScore` | 0.5 | Score for new agents |
| `minScore` | 0.05 | Floor (agents are never fully excluded) |

## Trade Outcome Processing

1. Trade closes → `processTradeOutcome()` called
2. If PnL > 0 → reward = 1 (correct)
3. If PnL ≤ 0 → reward = 0 (incorrect)
4. EMA update applied
5. `tradeCount` and `correctCount` updated
6. `CredibilityUpdatedEvent` emitted
