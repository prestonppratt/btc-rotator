import { buildResearchStatus } from "@/lib/research-status"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

function statusStyle(status: "ready" | "missing" | "review_required") {
  return status === "ready"
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    : status === "review_required"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
      : "border-red-500/30 bg-red-500/10 text-red-200"
}

export default function Desk() {
  const research = buildResearchStatus()

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <p className="font-mono text-xs tracking-widest text-amber-200">RESEARCH MODE — DECISIONS BLOCKED</p>
        <p className="mt-2 text-sm leading-6 text-muted">{research.decision} This private application is an analytical aid, not execution, investment advice, or a promise of performance.</p>
      </section>

      <section className="grid grid-cols-12 gap-4">
        <div className="col-span-12 rounded-xl border border-line bg-panel p-5 lg:col-span-7">
          <p className="font-mono text-xs tracking-widest text-muted">BTC-PROXY PORTFOLIO — IMPORTED SNAPSHOT</p>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs text-muted">BTC and eligible Bitcoin-proxy market value</p>
              <p className="font-mono text-3xl">{money.format(research.total_market_value_usd)}</p>
            </div>
            <div className="text-right text-xs text-muted">
              <p>As of {new Date(research.as_of).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p>
              <p className="mt-1">Account identifiers and non-Bitcoin holdings are excluded.</p>
            </div>
          </div>
        </div>
        <div className="col-span-12 rounded-xl border border-line bg-panel p-5 lg:col-span-5">
          <p className="font-mono text-xs tracking-widest text-muted">MODEL STATUS</p>
          <p className="mt-4 font-mono text-2xl text-amber-200">{research.mode.toUpperCase()}</p>
          <p className="mt-1 text-xs text-muted">Probability of trade success: unavailable until the model passes its calibration gate.</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-line bg-panel">
        <div className="border-b border-line px-4 py-3">
          <h1 className="font-mono text-xs tracking-widest">ELIGIBLE EXPOSURES</h1>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#0f0f0f] text-[11px] tracking-widest text-muted">
              <tr><th className="px-4 py-3 text-left">Ticker</th><th className="px-4 py-3 text-left">Class</th><th className="px-4 py-3 text-right">Quantity</th><th className="px-4 py-3 text-right">Snapshot price</th><th className="px-4 py-3 text-right">Market value</th><th className="px-4 py-3 text-right">Weight</th></tr>
            </thead>
            <tbody className="font-mono text-xs">
              {research.positions.map((position) => (
                <tr key={position.ticker} className="border-t border-line">
                  <td className="px-4 py-3 font-bold">{position.ticker}</td>
                  <td className="px-4 py-3 text-muted">{position.asset_class.replaceAll("_", " ")}</td>
                  <td className="px-4 py-3 text-right">{position.quantity.toLocaleString("en-US", { maximumFractionDigits: 6 })}</td>
                  <td className="px-4 py-3 text-right">{money.format(position.price_usd)}</td>
                  <td className="px-4 py-3 text-right">{money.format(position.market_value_usd)}</td>
                  <td className="px-4 py-3 text-right">{(position.weight * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {research.gates.map((gate) => (
          <article key={gate.label} className={`rounded-xl border p-4 ${statusStyle(gate.status)}`}>
            <p className="font-mono text-xs tracking-widest">{gate.status.replaceAll("_", " ")} — {gate.label}</p>
            <p className="mt-2 text-sm leading-6 text-muted">{gate.detail}</p>
          </article>
        ))}
      </section>

      <section className="rounded-xl border border-line bg-panel p-5 text-sm leading-6">
        <h2 className="font-mono text-xs tracking-widest">RELEASE CRITERIA FOR A TRADE MEMO</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-muted">
          <li>Licensed market data and filing-verified capital structure are current and traceable.</li>
          <li>The pair model clears costs, taxes, liquidity, issuer-stack, and stress gates.</li>
          <li>Its probability is calibrated out-of-sample—not inferred from a headline backtest.</li>
          <li>A human approves every ticket; the application never sends orders.</li>
        </ol>
      </section>
    </div>
  )
}
