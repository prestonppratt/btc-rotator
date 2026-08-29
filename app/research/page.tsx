import { buildResearchStatus } from "@/lib/research-status"

export default function Research() {
  const research = buildResearchStatus()
  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="font-mono text-sm tracking-widest">RESEARCH — VALIDATION REGISTER</h1>
      <section className="rounded-xl border border-line bg-panel p-6">
        <p className="font-mono text-xs tracking-widest text-muted">CURRENT STATE: {research.mode.toUpperCase()}</p>
        <p className="mt-3 text-sm leading-6 text-muted">Synthetic artifacts and illustrative charts have been retired from this decision surface. No performance or probability is displayed until it can be reproduced from immutable, point-in-time inputs.</p>
      </section>
      <section className="rounded-xl border border-line bg-panel p-6">
        <h2 className="font-mono text-xs tracking-widest">REQUIRED RESEARCH CHECKS</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-muted">
          <li>Point-in-time price, filings, capital structure, and corporate-action history.</li>
          <li>Walk-forward train/test splits with the decision date preceding the execution date.</li>
          <li>BTC-denominated comparison against BTC/IBIT, MSTR, and fixed-weight benchmarks.</li>
          <li>Costs, borrow where applicable, tax assumptions, liquidity limits, and stress tests.</li>
          <li>Calibrated out-of-sample probability and confidence intervals, withheld when sample size is inadequate.</li>
        </ol>
      </section>
    </div>
  )
}
