import { portfolioSnapshot, portfolioWeights, totalMarketValue } from "@/lib/portfolio-snapshot"

export type EvidenceStatus = "blocked" | "shadow" | "review" | "production"

export type DataGate = {
  label: string
  status: "ready" | "missing" | "review_required"
  detail: string
}

export function buildResearchStatus() {
  const gates: DataGate[] = [
    {
      label: "Market data",
      status: "review_required",
      detail: "Imported prices are a brokerage snapshot; no licensed point-in-time market-data feed is connected.",
    },
    {
      label: "Capital structure",
      status: "missing",
      detail: "No filing-verified BTC holdings, diluted shares, or senior claims are loaded for the treasury issuers.",
    },
    {
      label: "Tax lots",
      status: "review_required",
      detail: "The sanitized import deliberately excludes account numbers and lot-level tax records.",
    },
    {
      label: "Out-of-sample calibration",
      status: "missing",
      detail: "No validated point-in-time backtest exists, so a probability of success must not be published.",
    },
  ]

  const ready = gates.every((gate) => gate.status === "ready")
  return {
    as_of: portfolioSnapshot.as_of,
    mode: (ready ? "shadow" : "blocked") as EvidenceStatus,
    total_market_value_usd: totalMarketValue(),
    positions: portfolioWeights(),
    gates,
    decision: ready
      ? "Shadow-mode research may run; human approval remains required."
      : "No repositioning recommendation: required evidence gates are incomplete.",
    probability_of_success: null,
    probability_note:
      "A probability is released only after calibration on point-in-time, out-of-sample observations. It is intentionally unavailable now.",
  }
}
