export default function Methodology(){
  return (
    <div className="space-y-6 max-w-4xl text-sm leading-relaxed">
      <h1 className="font-mono text-sm tracking-widest">METHODOLOGY — BRAE</h1>
      <div className="bg-panel border border-line rounded-xl p-6 space-y-4">
        <p><b>Objective:</b> grow BTC-equivalent NAV W₿ = V_usd/P_btc. USD shown alongside, never instead. Book stays in BTC + BTC-linked US-listed instruments.</p>
        <h2 className="font-mono text-xs tracking-widest text-muted">A. Look-through accounting</h2>
        <p>Mark-to-market BTC-eq = usd_mv/P_btc. Commons also show shares×CEBE. Preferreds are not 1:1 coin claims — show par coverage and recovery.</p>
        <h2 className="font-mono text-xs tracking-widest text-muted">B. Derived metrics</h2>
        <pre className="bg-[#0f0f0f] border border-line rounded p-3 text-xs font-mono overflow-auto">mNAV_gross = cap / (btc*P)
mNAV_ev    = (cap+debt+pref-cash)/(btc*P)
senior     = OTM_converts + pref_notional - reserve
net_btc    = btc - senior/P
CEBE       = net_btc/ADSO
mNAV_cebe  = price/(CEBE*P)</pre>
        <p>Never treat gross BPS as what common owns when preferreds sit above it. Flag holdings_as_of vs price_as_of.</p>
        <h2 className="font-mono text-xs tracking-widest text-muted">C. Expected excess (9M horizon)</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>B1</b> CEF-discount mean-reversion: α = κ*(fair−now)/now, κ small, half-life months.</li>
          <li><b>B2</b> Accretion/dilution: forecast CEBE/share from policy + 90d pace + coupon drain.</li>
          <li><b>B3</b> Peer residual: cross-sectional regression on mNAV_cebe, leverage, ADV, issuer dummy.</li>
          <li><b>B4</b> Preferreds in BTC terms: r_btc = (1+usd_ret)*(P_now/E[P_H])−1. High USD yield can lose BTC if BTC rips.</li>
          <li><b>B5</b> ETF/spot: E[r] ≈ −fee_drag.</li>
        </ul>
        <h2 className="font-mono text-xs tracking-widest text-muted">D. Construction</h2>
        <p>Maximize µ′w − λw′Σw − τ turnover. Long-only, sum w=1, core ≥40%, single common ≤20%, issuer stack ≤35%, credit 15–30% (STRD ≤5%), liquidity ≤5d ADV×10%, CVaR limit, three mandatory stresses.</p>
        <h2 className="font-mono text-xs tracking-widest text-muted">References (cited, not faked)</h2>
        <ul className="list-disc pl-5 text-xs">
          <li>Gatev–Goetzmann–Rouwenhorst (2006) — contrast: we do not run 6M/2-day pairs.</li>
          <li>Pontiff (1996) + CEF discount literature — slow mean-reversion.</li>
          <li>Gârleanu & Pedersen (2013) — trade only when edge exceeds costs.</li>
          <li>Constantinides (1984); Dammon–Spatt–Zhang — tax-aware deferral.</li>
          <li>Maillard–Roncalli–Teiletche (2010) — risk budgeting.</li>
          <li>Rockafellar & Uryasev (2000) — CVaR.</li>
          <li>Bailey & López de Prado (2014) Deflated Sharpe; López de Prado purged/embargoed CV.</li>
          <li>Strategy 2026 Net Reserve / Net Bitcoin Per Share definitions.</li>
        </ul>
        <h2 className="font-mono text-xs tracking-widest text-muted">What is NOT claimed</h2>
        <p className="text-muted">No guarantee of alpha. Preferreds short history. Walk-forward with costs/tax is the only publishable line. No miners, non-US, or operating businesses. Not an auto-trader in v1.</p>
      </div>
    </div>
  )
}
