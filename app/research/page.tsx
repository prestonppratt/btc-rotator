import { issuerProfiles, secCompanyUrl } from "@/lib/issuer-registry"

export default function CompanyResearch() {
  return (
    <div className="max-w-4xl space-y-6">
      <section className="rounded-xl border border-line bg-panel p-5">
        <p className="font-mono text-xs tracking-widest text-muted">COMPANY RESEARCH</p>
        <h1 className="mt-3 text-2xl">The companies and funds BTC Rotator follows</h1>
        <p className="mt-3 text-sm leading-6 text-muted">Each card links to the official SEC filing record. As the SEC collector runs, this page will add filing-backed Bitcoin holdings, financing details, and changes worth reviewing.</p>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        {issuerProfiles.map((issuer) => (
          <article key={issuer.ticker} className="rounded-xl border border-line bg-panel p-5">
            <p className="font-mono text-lg">{issuer.ticker}</p>
            <p className="mt-1 text-sm text-white">{issuer.name}</p>
            <p className="mt-1 text-xs text-muted">{issuer.type}</p>
            <p className="mt-4 text-sm leading-6 text-muted">{issuer.whyItMatters}</p>
            <a className="mt-4 inline-block text-sm text-orange-300 hover:text-orange-200" href={secCompanyUrl(issuer.secCik)} rel="noreferrer" target="_blank">View official SEC filings ↗</a>
          </article>
        ))}
      </div>
    </div>
  )
}
