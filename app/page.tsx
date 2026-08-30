import { buildResearchStatus } from "@/lib/research-status"
import { ScenarioPlanner } from "@/components/ScenarioPlanner"

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

export default function Portfolio() {
  const research = buildResearchStatus()
  const snapshotDate = new Date(research.as_of).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  })

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-line bg-panel p-5">
        <p className="font-mono text-xs tracking-widest text-muted">YOUR BITCOIN &amp; BITCOIN-PROXY PORTFOLIO</p>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs text-muted">Value of included positions</p>
            <p className="font-mono text-3xl">{money.format(research.total_market_value_usd)}</p>
          </div>
          <div className="text-right text-xs text-muted">
            <p>Imported {snapshotDate}</p>
            <p className="mt-1">Only Bitcoin and Bitcoin-proxy positions are shown.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <article className="rounded-xl border border-line bg-panel p-4">
          <p className="text-xs text-muted">Direct Bitcoin exposure</p>
          <p className="mt-2 font-mono text-xl">90.4%</p>
          <p className="mt-2 text-xs leading-5 text-muted">BTC and FBTC make up most of the included portfolio.</p>
        </article>
        <article className="rounded-xl border border-line bg-panel p-4">
          <p className="text-xs text-muted">Company-proxy exposure</p>
          <p className="mt-2 font-mono text-xl">9.6%</p>
          <p className="mt-2 text-xs leading-5 text-muted">MSTR, ASST, and STRC add company and financing considerations.</p>
        </article>
        <article className="rounded-xl border border-line bg-panel p-4">
          <p className="text-xs text-muted">Largest position</p>
          <p className="mt-2 font-mono text-xl">FBTC</p>
          <p className="mt-2 text-xs leading-5 text-muted">45.2% of the included portfolio at the imported snapshot.</p>
        </article>
      </section>

      <section className="overflow-hidden rounded-xl border border-line bg-panel">
        <div className="border-b border-line px-4 py-3">
          <h1 className="font-mono text-xs tracking-widest">POSITIONS</h1>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#0f0f0f] text-[11px] tracking-widest text-muted">
              <tr><th className="px-4 py-3 text-left">Ticker</th><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-right">Quantity</th><th className="px-4 py-3 text-right">Price</th><th className="px-4 py-3 text-right">Value</th><th className="px-4 py-3 text-right">Portfolio weight</th></tr>
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

      <ScenarioPlanner positions={research.positions} />

      <details className="rounded-xl border border-line bg-panel p-5 text-sm leading-6 text-muted">
        <summary className="cursor-pointer font-mono text-xs tracking-widest text-white">WHY THERE ARE NO TRADE IDEAS YET</summary>
        <div className="mt-3 space-y-3">
          <p>Right now, BTC Rotator is a clean view of the Bitcoin-related positions from your portfolio file. Its prices are a snapshot, not a live feed.</p>
          <p>Before it suggests a swap, we will connect current market prices, verify each company&apos;s Bitcoin holdings and debt from its filings, and test any proposed approach against real historical periods. Until then, showing a buy or sell recommendation would be guesswork.</p>
        </div>
      </details>
    </div>
  )
}
