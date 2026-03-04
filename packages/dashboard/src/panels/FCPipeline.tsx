import type { ReactNode } from "react";
import { usePodStore } from "../store/index.js";

interface Props {
  compact?: boolean;
}

export function FCPipeline({ compact }: Props) {
  const latestDecision = usePodStore((s) => s.latestDecision);
  const decisions = usePodStore((s) => s.decisions);

  if (compact) {
    return (
      <div className="card col-span-1 lg:col-span-2">
        <h3 className="card-title">FC Pipeline</h3>
        {latestDecision ? (
          <div className="flex gap-4 mt-2 text-sm">
            <PipelineStep
              label="Signals"
              value={String(latestDecision.contributingSignals.length)}
            />
            <PipelineArrow />
            <PipelineStep
              label="Consensus"
              value={`${latestDecision.consensus.direction.toUpperCase()} ${(latestDecision.consensus.confidence * 100).toFixed(0)}%`}
            />
            <PipelineArrow />
            <PipelineStep
              label="Risk"
              value={latestDecision.allRiskChecksPassed ? "✓ Pass" : "✗ Fail"}
              success={latestDecision.allRiskChecksPassed}
            />
            <PipelineArrow />
            <PipelineStep
              label="Decision"
              value={latestDecision.approved ? "APPROVED" : "REJECTED"}
              success={latestDecision.approved}
            />
          </div>
        ) : (
          <p className="text-sm text-gray-600 mt-2">No decisions yet</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Financial Controller Pipeline</h2>

      {/* Latest decision pipeline visualization */}
      {latestDecision && (
        <div className="card">
          <h3 className="card-title mb-4">Latest Decision</h3>
          <div className="flex flex-wrap items-center gap-3">
            <PipelineBox label="Signals In" color="blue">
              {latestDecision.contributingSignals.map((s) => (
                <div key={s.signalId} className="text-xs text-gray-400">
                  {s.agentId}: {s.direction} {s.instrument}
                </div>
              ))}
            </PipelineBox>

            <PipelineArrow />

            <PipelineBox label="Weighted Consensus" color="blue">
              <div className="text-sm">
                <span className="font-medium">
                  {latestDecision.consensus.direction.toUpperCase()}
                </span>{" "}
                @{" "}
                {(latestDecision.consensus.confidence * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-gray-500">
                Score: {latestDecision.consensus.weightedScore.toFixed(3)}
              </div>
            </PipelineBox>

            <PipelineArrow />

            <PipelineBox
              label="Risk Checks"
              color={latestDecision.allRiskChecksPassed ? "green" : "red"}
            >
              {latestDecision.riskChecks.map((rc, i) => (
                <div key={i} className="text-xs flex gap-1">
                  <span>{rc.passed ? "✓" : "✗"}</span>
                  <span className={rc.passed ? "text-gray-400" : "text-pod-red"}>
                    {rc.rule}
                  </span>
                </div>
              ))}
            </PipelineBox>

            <PipelineArrow />

            <PipelineBox
              label="Decision"
              color={latestDecision.approved ? "green" : "red"}
            >
              <span className="text-lg font-bold">
                {latestDecision.approved ? "✓ APPROVED" : "✗ REJECTED"}
              </span>
              {latestDecision.rejectionReason && (
                <div className="text-xs text-pod-red mt-1">
                  {latestDecision.rejectionReason}
                </div>
              )}
            </PipelineBox>
          </div>
        </div>
      )}

      {/* Decision history */}
      <div className="card">
        <h3 className="card-title mb-3">Decision History</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-left border-b border-pod-border">
                <th className="pb-2 font-medium">Time</th>
                <th className="pb-2 font-medium">Dir</th>
                <th className="pb-2 font-medium">Conf</th>
                <th className="pb-2 font-medium">Risk</th>
                <th className="pb-2 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {decisions.slice(0, 30).map((d) => (
                <tr
                  key={d.decisionId}
                  className="border-b border-pod-border/50 hover:bg-pod-border/20"
                >
                  <td className="py-1.5 text-xs text-gray-400">
                    {new Date(d.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-1.5">
                    {d.consensus.direction.toUpperCase()}
                  </td>
                  <td className="py-1.5">
                    {(d.consensus.confidence * 100).toFixed(0)}%
                  </td>
                  <td className="py-1.5">
                    {d.allRiskChecksPassed ? (
                      <span className="text-pod-green">Pass</span>
                    ) : (
                      <span className="text-pod-red">Fail</span>
                    )}
                  </td>
                  <td className="py-1.5">
                    {d.approved ? (
                      <span className="text-pod-green font-medium">
                        Approved
                      </span>
                    ) : (
                      <span className="text-pod-red font-medium">
                        Rejected
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {decisions.length === 0 && (
            <p className="text-gray-600 text-sm py-4 text-center">
              No decisions yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// -- Helpers --

function PipelineStep({
  label,
  value,
  success,
}: {
  label: string;
  value: string;
  success?: boolean;
}) {
  const textColor =
    success === true
      ? "text-pod-green"
      : success === false
        ? "text-pod-red"
        : "text-gray-200";

  return (
    <div className="text-center">
      <div className="text-[10px] uppercase text-gray-500">{label}</div>
      <div className={`font-medium ${textColor}`}>{value}</div>
    </div>
  );
}

function PipelineArrow() {
  return <span className="text-gray-600 text-xl">→</span>;
}

function PipelineBox({
  label,
  color,
  children,
}: {
  label: string;
  color: "blue" | "green" | "red";
  children: ReactNode;
}) {
  const border =
    color === "green"
      ? "border-pod-green/40"
      : color === "red"
        ? "border-pod-red/40"
        : "border-pod-accent/40";

  return (
    <div
      className={`border ${border} rounded-lg p-3 bg-pod-surface min-w-[140px]`}
    >
      <div className="text-[10px] uppercase text-gray-500 mb-1">{label}</div>
      {children}
    </div>
  );
}
