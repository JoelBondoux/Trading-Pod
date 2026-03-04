import { usePodStore } from "../store/index.js";

interface Props {
  compact?: boolean;
}

export function SavingsPanel({ compact }: Props) {
  const savingsState = usePodStore((s) => s.savingsState);

  if (!savingsState) {
    return (
      <div className="card">
        <h3 className="card-title">Savings Vault</h3>
        <p className="text-sm text-gray-600 mt-2">No deposits yet</p>
      </div>
    );
  }

  const { totalLocked, depositCount, lastDepositAt } = savingsState;

  if (compact) {
    return (
      <div className="card">
        <h3 className="card-title">Savings</h3>
        <div className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Locked</span>
            <span className="text-pod-green font-medium">
              £{totalLocked.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Deposits</span>
            <span>{depositCount}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Savings Vault</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="text-[11px] uppercase text-gray-500">
            Total Locked (Permanent)
          </div>
          <div className="text-2xl font-bold text-pod-green mt-1">
            £{totalLocked.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            Funds never return to the trading pool
          </div>
        </div>

        <div className="card">
          <div className="text-[11px] uppercase text-gray-500">Deposits</div>
          <div className="text-2xl font-bold mt-1">{depositCount}</div>
        </div>

        <div className="card">
          <div className="text-[11px] uppercase text-gray-500">
            Last Deposit
          </div>
          <div className="text-lg mt-1">
            {lastDepositAt
              ? new Date(lastDepositAt).toLocaleString()
              : "—"}
          </div>
        </div>
      </div>

      {/* Growth curve placeholder */}
      <div className="card">
        <h3 className="card-title mb-3">Growth Curve</h3>
        <p className="text-sm text-gray-600 py-8 text-center">
          Chart will populate as deposits accumulate over time.
        </p>
      </div>
    </div>
  );
}
