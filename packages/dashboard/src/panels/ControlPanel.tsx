import { usePodStore } from "../store/index.js";

export function ControlPanel() {
  const status = usePodStore((state) => state.runtimeStatus);
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Trading controls</h2>
      <div className="card space-y-3">
        <h3 className="card-title">Execution locked</h3>
        <p className="text-sm text-gray-400">
          {status
            ? "The server confirms that execution is paused."
            : "Server status is unavailable. Controls remain locked."}
        </p>
        <p className="text-sm text-gray-400">
          Practice trading controls will become available after risk limits, broker reconciliation
          and protective orders have passed validation.
        </p>
        <button
          disabled
          className="px-4 py-2 rounded-md bg-pod-border text-gray-500 cursor-not-allowed text-sm"
        >
          Practice trading unavailable
        </button>
      </div>
    </div>
  );
}
