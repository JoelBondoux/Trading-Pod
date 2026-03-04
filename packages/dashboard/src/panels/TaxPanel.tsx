import { usePodStore } from "../store/index.js";

interface Props {
  compact?: boolean;
}

export function TaxPanel({ compact }: Props) {
  const taxState = usePodStore((s) => s.taxState);

  if (!taxState) {
    return (
      <div className="card">
        <h3 className="card-title">Tax Reserve</h3>
        <p className="text-sm text-gray-600 mt-2">
          No crypto gains reserved yet
        </p>
      </div>
    );
  }

  const {
    taxYear,
    totalReserved,
    totalTrades,
    totalGrossProfit,
    annualExemptRemaining,
    useAnnualExempt,
  } = taxState;

  if (compact) {
    return (
      <div className="card">
        <h3 className="card-title">Tax (CGT)</h3>
        <div className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Reserved</span>
            <span className="text-pod-amber font-medium">
              £{totalReserved.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Gross profit</span>
            <span>£{totalGrossProfit.toFixed(2)}</span>
          </div>
          {useAnnualExempt && (
            <div className="flex justify-between">
              <span className="text-gray-400">Exempt left</span>
              <span>£{annualExemptRemaining.toFixed(0)}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">UK Tax Reserve (Crypto CGT)</h2>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="card">
          <div className="text-[11px] uppercase text-gray-500">Tax Year</div>
          <div className="text-xl font-bold mt-1">{taxYear}</div>
        </div>

        <div className="card">
          <div className="text-[11px] uppercase text-gray-500">
            Total Gross Profit
          </div>
          <div className="text-xl font-bold mt-1">
            £{totalGrossProfit.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            cumulative crypto gains this year
          </div>
        </div>

        <div className="card">
          <div className="text-[11px] uppercase text-gray-500">
            Total Reserved
          </div>
          <div className="text-xl font-bold text-pod-amber mt-1">
            £{totalReserved.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            24% rate on gains{useAnnualExempt ? " above exempt threshold" : ""}
          </div>
        </div>

        <div className="card">
          <div className="text-[11px] uppercase text-gray-500">
            {useAnnualExempt ? "Annual Exempt Remaining" : "Annual Exempt"}
          </div>
          <div className="text-xl font-bold mt-1">
            {useAnnualExempt
              ? `£${annualExemptRemaining.toFixed(0)}`
              : "Disabled"}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {useAnnualExempt
              ? "of £3,000 — tax starts once exceeded"
              : "every profit taxed immediately"}
          </div>
        </div>

        <div className="card">
          <div className="text-[11px] uppercase text-gray-500">
            Taxable Trades
          </div>
          <div className="text-xl font-bold mt-1">{totalTrades}</div>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Important Notes</h3>
        <ul className="text-sm text-gray-400 mt-2 space-y-1 list-disc list-inside">
          <li>
            FX spread bets are <strong className="text-pod-green">tax-free</strong> (gambling, not
            taxable in UK).
          </li>
          <li>
            Crypto spot profits are subject to Capital Gains Tax at 24%.
          </li>
          {useAnnualExempt ? (
            <li>
              Annual exempt threshold is <strong>enabled</strong> — tax is only
              reserved once cumulative crypto gains exceed £3,000 per tax year.
            </li>
          ) : (
            <li>
              Annual exempt threshold is <strong>disabled</strong> — CGT is
              reserved on every profitable crypto trade.
            </li>
          )}
          <li>
            The reserve is an <em>estimate</em>. Actual CGT calculation must be
            done at year-end using same-day / 30-day matching rules.
          </li>
          <li>
            Recommend using Koinly or similar software for final tax reporting.
          </li>
        </ul>
      </div>
    </div>
  );
}
