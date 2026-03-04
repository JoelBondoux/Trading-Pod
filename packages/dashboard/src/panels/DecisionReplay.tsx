import { useState } from "react";
import { usePodStore } from "../store/index.js";

export function DecisionReplay() {
  const decisions = usePodStore((s) => s.decisions);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = decisions.find((d) => d.decisionId === selectedId);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Decision Replay</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Decision list */}
        <div className="card lg:col-span-1 max-h-[600px] overflow-y-auto">
          <h3 className="card-title mb-3">Decisions</h3>
          {decisions.length === 0 && (
            <p className="text-gray-600 text-sm">No decisions recorded</p>
          )}
          {decisions.map((d) => (
            <button
              key={d.decisionId}
              onClick={() => setSelectedId(d.decisionId)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm mb-1 transition-colors ${
                selectedId === d.decisionId
                  ? "bg-pod-accent/20 text-pod-accent"
                  : "text-gray-400 hover:bg-pod-border/40 hover:text-gray-200"
              }`}
            >
              <div className="flex justify-between items-center">
                <span>
                  {d.consensus.direction.toUpperCase()}{" "}
                  {d.contributingSignals[0]?.instrument ?? "—"}
                </span>
                <span
                  className={`text-xs ${
                    d.approved ? "text-pod-green" : "text-pod-red"
                  }`}
                >
                  {d.approved ? "OK" : "REJ"}
                </span>
              </div>
              <div className="text-[10px] text-gray-600">
                {new Date(d.timestamp).toLocaleString()}
              </div>
            </button>
          ))}
        </div>

        {/* Detail panel */}
        <div className="card lg:col-span-2">
          {selected ? (
            <div className="space-y-4">
              <h3 className="card-title">
                Decision {selected.decisionId.slice(0, 8)}…
              </h3>

              {/* Meta */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label="Time" value={new Date(selected.timestamp).toLocaleString()} />
                <Field
                  label="Result"
                  value={selected.approved ? "APPROVED" : "REJECTED"}
                  valueClass={selected.approved ? "text-pod-green" : "text-pod-red"}
                />
                <Field
                  label="Direction"
                  value={selected.consensus.direction.toUpperCase()}
                />
                <Field
                  label="Confidence"
                  value={`${(selected.consensus.confidence * 100).toFixed(0)}%`}
                />
                <Field
                  label="Weighted Score"
                  value={selected.consensus.weightedScore.toFixed(4)}
                />
                <Field
                  label="Signals"
                  value={String(selected.consensus.signalCount)}
                />
              </div>

              {/* Risk checks */}
              <div>
                <h4 className="text-xs uppercase text-gray-500 mb-2">
                  Risk Checks
                </h4>
                <div className="space-y-1">
                  {selected.riskChecks.map((rc, i) => (
                    <div
                      key={i}
                      className={`text-sm flex items-center gap-2 ${
                        rc.passed ? "text-gray-400" : "text-pod-red"
                      }`}
                    >
                      <span>{rc.passed ? "✓" : "✗"}</span>
                      <span>{rc.rule}</span>
                      {rc.reason && (
                        <span className="text-xs text-gray-600">
                          — {rc.reason}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Contributing signals */}
              <div>
                <h4 className="text-xs uppercase text-gray-500 mb-2">
                  Contributing Signals
                </h4>
                <div className="space-y-2">
                  {selected.contributingSignals.map((s) => (
                    <div
                      key={s.signalId}
                      className="bg-pod-bg rounded-md p-2 text-sm"
                    >
                      <div className="flex justify-between">
                        <span className="font-medium">{s.agentId}</span>
                        <span className="text-gray-500">{s.source}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {s.instrument} · {s.direction.toUpperCase()} ·{" "}
                        {(s.confidence * 100).toFixed(0)}% ·{" "}
                        {s.assetClass.toUpperCase()}
                      </div>
                      <p className="text-xs text-gray-600 mt-1 italic">
                        {s.justification}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {selected.rejectionReason && (
                <div className="bg-pod-red/10 border border-pod-red/30 rounded-md p-3 text-sm text-pod-red">
                  <strong>Rejection Reason:</strong> {selected.rejectionReason}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-600">
              Select a decision to replay
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  valueClass = "text-gray-200",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase text-gray-500">{label}</div>
      <div className={`font-medium ${valueClass}`}>{value}</div>
    </div>
  );
}
