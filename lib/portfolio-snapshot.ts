import snapshot from "@/data/private/portfolio_snapshot_2026-08-29.json"

export type PortfolioPosition = {
  ticker: string
  asset_class: "spot" | "spot_etf" | "treasury_common" | "treasury_preferred"
  quantity: number
  price_usd: number
  market_value_usd: number
}

export const portfolioSnapshot = snapshot as {
  as_of: string
  source: string
  scope: string
  positions: PortfolioPosition[]
}

export function totalMarketValue(positions = portfolioSnapshot.positions) {
  return positions.reduce((total, position) => total + position.market_value_usd, 0)
}

export function portfolioWeights(positions = portfolioSnapshot.positions) {
  const total = totalMarketValue(positions)
  return positions.map((position) => ({
    ...position,
    weight: total === 0 ? 0 : position.market_value_usd / total,
  }))
}
