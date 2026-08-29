import { buildResearchStatus } from "@/lib/research-status"

export default function Report() {
  const research = buildResearchStatus()
  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="font-mono text-sm tracking-widest">ACTION REPORT — EVIDENCE GATE</h1>
      <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
        <p className="font-mono text-lg text-amber-200">NO ACTION.</p>
        <p className="mt-3 text-sm leading-6 text-muted">{research.decision}</p>
      </section>
      <section className="rounded-xl border border-line bg-panel p-6 text-sm leading-7">
        <h2 className="font-mono text-xs tracking-widest">WHAT THIS REPORT WILL REQUIRE</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
          <li>Filing-backed CEBE and senior-claim inputs, each with source URL, effective date, and review status.</li>
          <li>Current bid/ask, liquidity, and estimated transaction-cost inputs for every proposed leg.</li>
          <li>Lot-level tax impact, including a wash-sale and holding-period screen.</li>
          <li>Out-of-sample calibrated return distribution, stress tests, and explicit invalidation conditions.</li>
        </ul>
      </section>
      <section className="rounded-xl border border-line bg-panel p-6 text-sm text-muted">
        <p>When these gates are complete, this route will render a versioned Markdown, HTML, and PDF research memo. Human approval will remain mandatory and no broker order endpoint will be added.</p>
      </section>
    </div>
  )
}
