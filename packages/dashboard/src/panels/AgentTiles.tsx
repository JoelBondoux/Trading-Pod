import { usePodStore } from "../store/index.js";

interface Props {
  compact?: boolean;
}

const DIRECTION_COLOR: Record<string, string> = {
  long: "text-pod-green",
  short: "text-pod-red",
};

const AGENT_LABELS: Record<string, string> = {
  trend_agent: "Trend",
  mean_reversion_agent: "Mean Reversion",
  volatility_agent: "Volatility",
  momentum_agent: "Momentum",
};

export function AgentTiles({ compact }: Props) {
  const signals = usePodStore((s) => s.signals);
  const credibility = usePodStore((s) => s.credibility);

  const agentIds = Object.keys(AGENT_LABELS);

  // Latest signal per agent
  const latestByAgent = agentIds.reduce<
    Record<string, (typeof signals)[number] | undefined>
  >((acc, id) => {
    acc[id] = signals.find((s) => s.agentId === id);
    return acc;
  }, {});

  if (compact) {
    return (
      <div className="card">
        <h3 className="card-title">Agents</h3>
        <div className="space-y-2">
          {agentIds.map((id) => {
            const cred = credibility[id];
            return (
              <div
                key={id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-gray-300">
                  {AGENT_LABELS[id] ?? id}
                </span>
                <span className="text-gray-500">
                  cred: {cred ? (cred.score * 100).toFixed(0) + "%" : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Signal Agents</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {agentIds.map((id) => {
          const cred = credibility[id];
          const latest = latestByAgent[id];

          return (
            <div key={id} className="card space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-100">
                  {AGENT_LABELS[id] ?? id}
                </h3>
                <CredibilityBadge score={cred?.score} />
              </div>

              {latest ? (
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Pair</span>
                    <span>{latest.instrument}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Direction</span>
                    <span
                      className={
                        DIRECTION_COLOR[latest.direction] ?? "text-gray-300"
                      }
                    >
                      {latest.direction.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Confidence</span>
                    <span>{(latest.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Asset</span>
                    <span className="uppercase">{latest.assetClass}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 italic">
                    {latest.justification}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-600">No signals yet</p>
              )}

              {cred && (
                <div className="text-[11px] text-gray-600 border-t border-pod-border pt-2 flex justify-between">
                  <span>
                    Trades: {cred.tradeCount} | Correct: {cred.correctCount}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recent signals table */}
      <div className="card">
        <h3 className="card-title mb-3">Recent Signals</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-left border-b border-pod-border">
                <th className="pb-2 font-medium">Time</th>
                <th className="pb-2 font-medium">Agent</th>
                <th className="pb-2 font-medium">Pair</th>
                <th className="pb-2 font-medium">Dir</th>
                <th className="pb-2 font-medium">Conf</th>
                <th className="pb-2 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {signals.slice(0, 20).map((s) => (
                <tr
                  key={s.signalId}
                  className="border-b border-pod-border/50 hover:bg-pod-border/20"
                >
                  <td className="py-1.5 text-gray-400 text-xs">
                    {new Date(s.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-1.5">
                    {AGENT_LABELS[s.agentId] ?? s.agentId}
                  </td>
                  <td className="py-1.5">{s.instrument}</td>
                  <td
                    className={`py-1.5 ${DIRECTION_COLOR[s.direction] ?? ""}`}
                  >
                    {s.direction.toUpperCase()}
                  </td>
                  <td className="py-1.5">
                    {(s.confidence * 100).toFixed(0)}%
                  </td>
                  <td className="py-1.5 text-gray-500">{s.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {signals.length === 0 && (
            <p className="text-gray-600 text-sm py-4 text-center">
              No signals received yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CredibilityBadge({ score }: { score?: number }) {
  if (score == null) {
    return (
      <span className="text-xs bg-pod-border px-2 py-0.5 rounded-full text-gray-500">
        —
      </span>
    );
  }

  const pct = score * 100;
  const color =
    pct >= 70
      ? "bg-pod-green/20 text-pod-green"
      : pct >= 40
        ? "bg-pod-amber/20 text-pod-amber"
        : "bg-pod-red/20 text-pod-red";

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${color}`}>
      {pct.toFixed(0)}%
    </span>
  );
}
