import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { usePodStore } from "../store/index.js";

interface Props {
  compact?: boolean;
}

export function TreasurerPanel({ compact }: Props) {
  const treasurerState = usePodStore((s) => s.treasurerState);

  if (!treasurerState) {
    return (
      <div className="card">
        <h3 className="card-title">Treasurer</h3>
        <p className="text-sm text-gray-600 mt-2">Awaiting first state update…</p>
      </div>
    );
  }

  const {
    baseCapital,
    dailyAllocated,
    dailyCeiling,
    scaleFactor,
    rollingPnL,
  } = treasurerState;

  const dailyUsedPct = dailyCeiling > 0 ? (dailyAllocated / dailyCeiling) * 100 : 0;
  const rollingTotal = rollingPnL.reduce((a, b) => a + b, 0);

  // Build sparkline data from rolling PnL
  const sparkData = rollingPnL.map((v, i) => ({
    idx: i,
    pnl: v,
    cumulative: rollingPnL.slice(0, i + 1).reduce((a, b) => a + b, 0),
  }));

  if (compact) {
    return (
      <div className="card">
        <h3 className="card-title">Treasurer</h3>
        <div className="mt-2 space-y-1 text-sm">
          <Row label="Base Capital" value={`£${baseCapital.toFixed(2)}`} />
          <Row
            label="Daily Used"
            value={`${dailyUsedPct.toFixed(0)}%`}
            valueColor={dailyUsedPct > 80 ? "text-pod-red" : "text-gray-200"}
          />
          <Row label="Scale Factor" value={`${(scaleFactor * 100).toFixed(2)}%`} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Treasurer</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Base Capital"
          value={`£${baseCapital.toFixed(2)}`}
        />
        <StatCard
          label="Scale Factor"
          value={`${(scaleFactor * 100).toFixed(2)}%`}
          sub={`Max ${(treasurerState.maxScaleFactor * 100).toFixed(1)}%`}
        />
        <StatCard
          label="Daily Allocation"
          value={`£${dailyAllocated.toFixed(2)} / £${dailyCeiling.toFixed(2)}`}
          sub={`${dailyUsedPct.toFixed(0)}% used`}
          highlight={dailyUsedPct > 80}
        />
      </div>

      {/* Rolling PnL */}
      <div className="card">
        <h3 className="card-title mb-3">
          Rolling PnL ({rollingPnL.length} trades) — Total:{" "}
          <span
            className={rollingTotal >= 0 ? "text-pod-green" : "text-pod-red"}
          >
            £{rollingTotal.toFixed(2)}
          </span>
        </h3>

        {sparkData.length > 1 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={sparkData}>
              <defs>
                <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="idx" hide />
              <YAxis
                width={50}
                tick={{ fontSize: 10, fill: "#666" }}
                tickFormatter={(v: number) => `£${v.toFixed(0)}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1a1d27",
                  border: "1px solid #2a2d37",
                  borderRadius: "6px",
                  fontSize: 12,
                }}
                formatter={(v: number) => [`£${v.toFixed(2)}`, "Cumulative PnL"]}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke="#22c55e"
                fill="url(#pnlGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-gray-600">Insufficient data for chart</p>
        )}
      </div>
    </div>
  );
}

// -- Sub-components --

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className="card">
      <div className="text-[11px] uppercase text-gray-500">{label}</div>
      <div
        className={`text-xl font-semibold mt-1 ${
          highlight ? "text-pod-red" : "text-gray-100"
        }`}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function Row({
  label,
  value,
  valueColor = "text-gray-200",
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      <span className={valueColor}>{value}</span>
    </div>
  );
}
