-- ============================================================================
-- Trading-Pod D1 Schema
-- ============================================================================
-- All stateful data lives in D1 (100K writes/day free tier).
-- KV is reserved for read-heavy config only.
-- ============================================================================

-- Trade executions
CREATE TABLE IF NOT EXISTS trades (
  execution_id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL,
  asset_class TEXT NOT NULL CHECK (asset_class IN ('fx', 'crypto')),
  instrument TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('long', 'short')),
  entry_price REAL NOT NULL,
  stop_loss REAL NOT NULL,
  take_profit REAL NOT NULL,
  position_size REAL NOT NULL,
  capital_allocated REAL NOT NULL,
  spread REAL NOT NULL DEFAULT 0,
  slippage REAL NOT NULL DEFAULT 0,
  broker_order_id TEXT,
  broker TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  exit_price REAL,
  pnl REAL,
  fees REAL NOT NULL DEFAULT 0,
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_opened ON trades(opened_at);
CREATE INDEX IF NOT EXISTS idx_trades_decision ON trades(decision_id);

-- FC decisions
CREATE TABLE IF NOT EXISTS fc_decisions (
  decision_id TEXT PRIMARY KEY,
  consensus_json TEXT NOT NULL,
  risk_checks_json TEXT NOT NULL,
  all_risk_checks_passed INTEGER NOT NULL DEFAULT 0,
  capital_requested REAL NOT NULL DEFAULT 0,
  capital_approved INTEGER NOT NULL DEFAULT 0,
  approved INTEGER NOT NULL DEFAULT 0,
  rejection_reason TEXT,
  contributing_signals_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_decisions_created ON fc_decisions(created_at);

-- Agent credibility scores
CREATE TABLE IF NOT EXISTS agent_credibility (
  agent_id TEXT PRIMARY KEY,
  score REAL NOT NULL DEFAULT 0.5,
  trade_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Treasurer state (single row)
CREATE TABLE IF NOT EXISTS treasurer_state (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  base_capital REAL NOT NULL DEFAULT 1000,
  daily_allocated REAL NOT NULL DEFAULT 0,
  daily_ceiling REAL NOT NULL DEFAULT 100,
  scale_factor REAL NOT NULL DEFAULT 0.01,
  min_scale_factor REAL NOT NULL DEFAULT 0.005,
  max_scale_factor REAL NOT NULL DEFAULT 0.05,
  rolling_pnl_json TEXT NOT NULL DEFAULT '[]',
  rolling_window_size INTEGER NOT NULL DEFAULT 20,
  current_day TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Savings deposits
CREATE TABLE IF NOT EXISTS savings (
  deposit_id TEXT PRIMARY KEY,
  amount REAL NOT NULL,
  execution_id TEXT NOT NULL,
  deposited_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Savings state (single row)
CREATE TABLE IF NOT EXISTS savings_state (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  total_locked REAL NOT NULL DEFAULT 0,
  deposit_count INTEGER NOT NULL DEFAULT 0,
  last_deposit_at TEXT
);

-- Tax reserve entries (crypto trades only)
CREATE TABLE IF NOT EXISTS tax_reserve (
  entry_id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  gross_profit REAL NOT NULL,
  reserve_rate REAL NOT NULL,
  reserved_amount REAL NOT NULL,
  tax_year TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tax_reserve_year ON tax_reserve(tax_year);

-- Tax reserve state (one row per tax year)
CREATE TABLE IF NOT EXISTS tax_reserve_state (
  tax_year TEXT PRIMARY KEY,
  total_reserved REAL NOT NULL DEFAULT 0,
  total_trades INTEGER NOT NULL DEFAULT 0,
  annual_exempt_remaining REAL NOT NULL DEFAULT 3000,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Audit log (append-only)
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_type ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
