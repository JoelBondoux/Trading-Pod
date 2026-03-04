import { usePodStore } from "../store/index.js";

interface Props {
  compact?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "text-gray-400",
  submitted: "text-pod-amber",
  filled: "text-pod-accent",
  partially_filled: "text-pod-amber",
  closed: "text-gray-500",
  cancelled: "text-gray-600",
  error: "text-pod-red",
};

export function ExecutionPanel({ compact }: Props) {
  const openTrades = usePodStore((s) => s.openTrades);
  const closedTrades = usePodStore((s) => s.closedTrades);

  const totalClosedPnL = closedTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);

  if (compact) {
    return (
      <div className="card">
        <h3 className="card-title">Execution</h3>
        <div className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Open</span>
            <span>{openTrades.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Closed</span>
            <span>{closedTrades.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Net PnL (closed)</span>
            <span
              className={
                totalClosedPnL >= 0 ? "text-pod-green" : "text-pod-red"
              }
            >
              £{totalClosedPnL.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Execution Engine</h2>

      {/* Open Positions */}
      <div className="card">
        <h3 className="card-title mb-3">
          Open Positions ({openTrades.length})
        </h3>
        <TradeTable trades={openTrades} showPnL={false} />
      </div>

      {/* Recent Closed */}
      <div className="card">
        <h3 className="card-title mb-3">
          Closed Trades — Net:{" "}
          <span
            className={totalClosedPnL >= 0 ? "text-pod-green" : "text-pod-red"}
          >
            £{totalClosedPnL.toFixed(2)}
          </span>
        </h3>
        <TradeTable trades={closedTrades.slice(0, 30)} showPnL />
      </div>
    </div>
  );
}

function TradeTable({
  trades,
  showPnL,
}: {
  trades: ReturnType<typeof usePodStore.getState>["openTrades"];
  showPnL: boolean;
}) {
  if (trades.length === 0) {
    return (
      <p className="text-gray-600 text-sm text-center py-4">No trades</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-left border-b border-pod-border">
            <th className="pb-2 font-medium">Time</th>
            <th className="pb-2 font-medium">Pair</th>
            <th className="pb-2 font-medium">Dir</th>
            <th className="pb-2 font-medium">Entry</th>
            <th className="pb-2 font-medium">SL</th>
            <th className="pb-2 font-medium">TP</th>
            <th className="pb-2 font-medium">Size</th>
            <th className="pb-2 font-medium">Broker</th>
            <th className="pb-2 font-medium">Status</th>
            {showPnL && <th className="pb-2 font-medium">PnL</th>}
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => (
            <tr
              key={t.executionId}
              className="border-b border-pod-border/50 hover:bg-pod-border/20"
            >
              <td className="py-1.5 text-xs text-gray-400">
                {new Date(t.openedAt).toLocaleTimeString()}
              </td>
              <td className="py-1.5">{t.instrument}</td>
              <td
                className={`py-1.5 ${
                  t.direction === "long" ? "text-pod-green" : "text-pod-red"
                }`}
              >
                {t.direction.toUpperCase()}
              </td>
              <td className="py-1.5">{t.entryPrice.toFixed(5)}</td>
              <td className="py-1.5 text-pod-red">{t.stopLoss.toFixed(5)}</td>
              <td className="py-1.5 text-pod-green">
                {t.takeProfit.toFixed(5)}
              </td>
              <td className="py-1.5">{t.positionSize}</td>
              <td className="py-1.5 text-gray-500">{t.broker}</td>
              <td className={`py-1.5 ${STATUS_COLORS[t.status] ?? ""}`}>
                {t.status}
              </td>
              {showPnL && (
                <td
                  className={`py-1.5 font-medium ${
                    (t.pnl ?? 0) >= 0 ? "text-pod-green" : "text-pod-red"
                  }`}
                >
                  £{(t.pnl ?? 0).toFixed(2)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
