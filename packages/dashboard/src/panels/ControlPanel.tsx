import { usePodStore } from "../store/index.js";

const AGENTS = [
  { id: "trend_agent", label: "Trend" },
  { id: "mean_reversion_agent", label: "Mean Reversion" },
  { id: "volatility_agent", label: "Volatility" },
  { id: "momentum_agent", label: "Momentum" },
];

export function ControlPanel() {
  const frozenAgents = usePodStore((s) => s.frozenAgents);
  const tradingPaused = usePodStore((s) => s.tradingPaused);
  const toggleFreezeAgent = usePodStore((s) => s.toggleFreezeAgent);
  const toggleTradingPaused = usePodStore((s) => s.toggleTradingPaused);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Control Panel</h2>

      {/* Global trading toggle */}
      <div className="card">
        <h3 className="card-title mb-3">Global Controls</h3>
        <div className="flex items-center gap-4">
          <button
            onClick={toggleTradingPaused}
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
              tradingPaused
                ? "bg-pod-green/20 text-pod-green hover:bg-pod-green/30"
                : "bg-pod-red/20 text-pod-red hover:bg-pod-red/30"
            }`}
          >
            {tradingPaused ? "▶ Resume Trading" : "⏸ Pause Trading"}
          </button>

          <span className="text-sm text-gray-500">
            {tradingPaused
              ? "All signal processing is paused. No new trades will be placed."
              : "System is actively processing signals and executing trades."}
          </span>
        </div>
      </div>

      {/* Agent freeze controls */}
      <div className="card">
        <h3 className="card-title mb-3">Agent Controls</h3>
        <p className="text-sm text-gray-500 mb-3">
          Freeze individual agents to exclude them from consensus computation.
        </p>
        <div className="space-y-2">
          {AGENTS.map((agent) => {
            const frozen = frozenAgents.has(agent.id);
            return (
              <div
                key={agent.id}
                className="flex items-center justify-between bg-pod-bg rounded-md px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      frozen ? "bg-pod-red" : "bg-pod-green"
                    }`}
                  />
                  <span className="text-sm">{agent.label}</span>
                </div>
                <button
                  onClick={() => toggleFreezeAgent(agent.id)}
                  className={`text-xs px-3 py-1 rounded-md transition-colors ${
                    frozen
                      ? "bg-pod-green/20 text-pod-green hover:bg-pod-green/30"
                      : "bg-pod-red/20 text-pod-red hover:bg-pod-red/30"
                  }`}
                >
                  {frozen ? "Unfreeze" : "Freeze"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Event log */}
      <div className="card">
        <h3 className="card-title mb-3">Event Log</h3>
        <EventLog />
      </div>
    </div>
  );
}

function EventLog() {
  const events = usePodStore((s) => s.eventLog);

  if (events.length === 0) {
    return <p className="text-sm text-gray-600">No events received yet</p>;
  }

  return (
    <div className="max-h-[400px] overflow-y-auto space-y-1">
      {events.slice(0, 100).map((e) => (
        <div
          key={e.eventId}
          className="flex gap-3 text-xs hover:bg-pod-border/20 rounded px-2 py-1"
        >
          <span className="text-gray-600 whitespace-nowrap">
            {new Date(e.timestamp).toLocaleTimeString()}
          </span>
          <span className="text-pod-accent font-mono">{e.type}</span>
          <span className="text-gray-500 truncate">
            {JSON.stringify(e.payload).slice(0, 120)}
          </span>
        </div>
      ))}
    </div>
  );
}
