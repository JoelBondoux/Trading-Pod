import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Matches BrokerAdapterType from @trading-pod/core */
type BrokerAdapterType = "mock" | "ig" | "capital" | "oanda";

interface BrokerPreferences {
  fx: BrokerAdapterType;
  crypto: BrokerAdapterType;
}

interface BrokerOption {
  value: BrokerAdapterType;
  label: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FC_URL =
  (import.meta as any).env?.VITE_FC_URL ?? "http://localhost:8788";
const INTERNAL_SECRET =
  (import.meta as any).env?.VITE_INTERNAL_SECRET ?? "";

const FX_BROKERS: BrokerOption[] = [
  {
    value: "ig",
    label: "IG",
    description: "Spread-betting (UK tax-free gains)",
  },
  {
    value: "capital",
    label: "Capital.com",
    description: "CFD trading, FX & crypto",
  },
  {
    value: "oanda",
    label: "OANDA",
    description: "FX specialist, tight spreads",
  },
  {
    value: "mock",
    label: "Paper (Mock)",
    description: "Simulated orders, no real money",
  },
];

const CRYPTO_BROKERS: BrokerOption[] = [
  {
    value: "capital",
    label: "Capital.com",
    description: "CFD crypto trading",
  },
  {
    value: "oanda",
    label: "OANDA",
    description: "Limited crypto via CFDs",
  },
  {
    value: "mock",
    label: "Paper (Mock)",
    description: "Simulated orders, no real money",
  },
];

const DEFAULT_PREFS: BrokerPreferences = { fx: "capital", crypto: "capital" };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SettingsPanel() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<BrokerPreferences>(DEFAULT_PREFS);
  const [tradingMode, setTradingMode] = useState<"paper" | "live">("paper");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load saved preferences on mount
  useEffect(() => {
    fetch(`${FC_URL}/settings/broker-preferences`, {
      headers: { "X-Internal-Secret": INTERNAL_SECRET },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          if (data.preferences) setPrefs(data.preferences);
          if (data.tradingMode) setTradingMode(data.tradingMode);
        }
      })
      .catch(() => {
        /* use defaults */
      });
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(`${FC_URL}/settings/broker-preferences`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": INTERNAL_SECRET,
        },
        body: JSON.stringify({ preferences: prefs, tradingMode }),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [prefs, tradingMode]);

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-semibold">Settings</h2>

      {/* Account info */}
      {user && (
        <div className="card">
          <h3 className="card-title mb-3">Account</h3>
          <div className="flex items-center gap-3">
            <img
              src={user.picture}
              alt=""
              className="h-10 w-10 rounded-full"
            />
            <div>
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
          </div>
        </div>
      )}

      {/* Trading Mode */}
      <div className="card">
        <h3 className="card-title mb-3">Trading Mode</h3>
        <div className="flex gap-3">
          <button
            onClick={() => setTradingMode("paper")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tradingMode === "paper"
                ? "bg-pod-blue/20 text-pod-blue ring-1 ring-pod-blue/40"
                : "bg-pod-bg text-gray-400 hover:text-gray-300"
            }`}
          >
            📄 Paper Trading
          </button>
          <button
            onClick={() => setTradingMode("live")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tradingMode === "live"
                ? "bg-pod-green/20 text-pod-green ring-1 ring-pod-green/40"
                : "bg-pod-bg text-gray-400 hover:text-gray-300"
            }`}
          >
            🔴 Live Trading
          </button>
        </div>
        {tradingMode === "live" && (
          <p className="mt-2 text-xs text-pod-red">
            ⚠ Live mode will place real orders with real money.
          </p>
        )}
      </div>

      {/* Broker selection per asset class */}
      <div className="card">
        <h3 className="card-title mb-3">Broker Selection</h3>
        <p className="text-sm text-gray-500 mb-4">
          Choose which broker to use for each asset class. In paper mode, the
          mock adapter is always used regardless of this setting.
        </p>

        <div className="space-y-4">
          {/* FX Broker */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              FX / Forex Broker
            </label>
            <div className="space-y-2">
              {FX_BROKERS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                    prefs.fx === opt.value
                      ? "bg-pod-blue/10 ring-1 ring-pod-blue/30"
                      : "bg-pod-bg hover:bg-pod-bg/80"
                  }`}
                >
                  <input
                    type="radio"
                    name="fx-broker"
                    value={opt.value}
                    checked={prefs.fx === opt.value}
                    onChange={() =>
                      setPrefs((p) => ({ ...p, fx: opt.value }))
                    }
                    className="accent-pod-blue"
                  />
                  <div>
                    <span className="text-sm font-medium">{opt.label}</span>
                    <span className="text-xs text-gray-500 ml-2">
                      {opt.description}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Crypto Broker */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Crypto Broker
            </label>
            <div className="space-y-2">
              {CRYPTO_BROKERS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                    prefs.crypto === opt.value
                      ? "bg-pod-blue/10 ring-1 ring-pod-blue/30"
                      : "bg-pod-bg hover:bg-pod-bg/80"
                  }`}
                >
                  <input
                    type="radio"
                    name="crypto-broker"
                    value={opt.value}
                    checked={prefs.crypto === opt.value}
                    onChange={() =>
                      setPrefs((p) => ({ ...p, crypto: opt.value }))
                    }
                    className="accent-pod-blue"
                  />
                  <div>
                    <span className="text-sm font-medium">{opt.label}</span>
                    <span className="text-xs text-gray-500 ml-2">
                      {opt.description}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2 rounded-md bg-pod-blue text-white text-sm font-medium hover:bg-pod-blue/80 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save Preferences"}
        </button>
        {saved && (
          <span className="text-sm text-pod-green">✓ Saved successfully</span>
        )}
        {error && <span className="text-sm text-pod-red">✗ {error}</span>}
      </div>

      {/* Invite system placeholder */}
      <div className="card opacity-60">
        <h3 className="card-title mb-2">Team & Invites</h3>
        <p className="text-sm text-gray-500">
          Invite collaborators with view-only access to your dashboard. Coming
          soon.
        </p>
      </div>
    </div>
  );
}
