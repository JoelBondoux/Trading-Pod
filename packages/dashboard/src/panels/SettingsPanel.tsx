import { usePodStore } from "../store/index.js";

export function SettingsPanel() {
  const status = usePodStore((state) => state.runtimeStatus);
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Experiment settings</h2>
      <div className="card space-y-3">
        <h3 className="card-title">OANDA practice · FX only</h3>
        <p className="text-sm text-gray-400">
          Broker connection and automated trading are under development. Live trading is locked.
        </p>
        {status ? (
          <dl className="text-sm space-y-2">
            <div>
              <dt className="text-gray-500">Mode</dt>
              <dd>{status.mode}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Research pairs</dt>
              <dd>{status.allowedInstruments.join(", ")}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Weekly review</dt>
              <dd>
                {status.weeklyReview.day} at {status.weeklyReview.time} (
                {status.weeklyReview.timezone})
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-pod-red">Waiting for verified server status.</p>
        )}
        <p className="text-xs text-gray-500">
          The review leaves the weekend for assessment and adjustments before the next trading week.
          Strategy changes will require a versioned review.
        </p>
      </div>
    </div>
  );
}
