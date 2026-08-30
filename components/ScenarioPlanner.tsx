"use client"

import { useMemo, useState } from "react"

type Position = {
  ticker: string
  market_value_usd: number
}

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

export function ScenarioPlanner({ positions }: { positions: Position[] }) {
  const [btcMove, setBtcMove] = useState(10)
  const [multipliers, setMultipliers] = useState<Record<string, number>>(
    Object.fromEntries(positions.map((position) => [position.ticker, 1])),
  )

  const rows = useMemo(() => positions.map((position) => {
    const multiplier = multipliers[position.ticker] ?? 1
    const priceMove = (btcMove / 100) * multiplier
    const change = position.market_value_usd * priceMove
    return { ...position, multiplier, change, scenarioValue: position.market_value_usd + change }
  }), [btcMove, multipliers, positions])
  const totalNow = positions.reduce((sum, position) => sum + position.market_value_usd, 0)
  const totalScenario = rows.reduce((sum, position) => sum + position.scenarioValue, 0)

  return (
    <section className="rounded-xl border border-line bg-panel p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-mono text-xs tracking-widest">SCENARIO PLANNER</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Test a Bitcoin move and choose how strongly each position responds. This is an assumption tool—not a forecast or a trade recommendation.</p>
        </div>
        <p className="font-mono text-xl">{money.format(totalScenario)}</p>
      </div>

      <label className="mt-6 block text-sm">
        <span className="text-muted">Assumed Bitcoin move</span>
        <span className="ml-3 font-mono text-white">{btcMove > 0 ? "+" : ""}{btcMove}%</span>
        <input
          className="mt-3 block w-full accent-orange-400"
          type="range"
          min="-50"
          max="100"
          step="5"
          value={btcMove}
          onChange={(event) => setBtcMove(Number(event.target.value))}
        />
      </label>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[11px] tracking-widest text-muted">
            <tr><th className="pb-2 text-left">Position</th><th className="pb-2 text-right">Response multiplier</th><th className="pb-2 text-right">Illustrative change</th><th className="pb-2 text-right">Scenario value</th></tr>
          </thead>
          <tbody className="font-mono text-xs">
            {rows.map((row) => (
              <tr key={row.ticker} className="border-t border-line">
                <td className="py-3 font-bold">{row.ticker}</td>
                <td className="py-3 text-right">
                  <input
                    aria-label={`${row.ticker} response multiplier`}
                    className="w-20 rounded border border-line bg-[#0f0f0f] px-2 py-1 text-right text-white"
                    min="-3"
                    max="5"
                    step="0.1"
                    type="number"
                    value={row.multiplier}
                    onChange={(event) => setMultipliers((current) => ({ ...current, [row.ticker]: Number(event.target.value) || 0 }))}
                  />
                </td>
                <td className={`py-3 text-right ${row.change >= 0 ? "text-emerald-300" : "text-red-300"}`}>{row.change >= 0 ? "+" : ""}{money.format(row.change)}</td>
                <td className="py-3 text-right">{money.format(row.scenarioValue)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-line font-mono text-xs">
            <tr><td className="pt-3 font-bold">Total</td><td /><td className={`pt-3 text-right ${totalScenario - totalNow >= 0 ? "text-emerald-300" : "text-red-300"}`}>{totalScenario - totalNow >= 0 ? "+" : ""}{money.format(totalScenario - totalNow)}</td><td className="pt-3 text-right">{money.format(totalScenario)}</td></tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
