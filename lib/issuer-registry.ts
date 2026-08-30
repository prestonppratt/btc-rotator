export type IssuerProfile = {
  ticker: "MSTR" | "STRC" | "ASST" | "FBTC" | "IBIT"
  name: string
  type: string
  secCik: string
  whyItMatters: string
}

export const issuerProfiles: IssuerProfile[] = [
  {
    ticker: "MSTR",
    name: "Strategy Inc.",
    type: "Bitcoin treasury company",
    secCik: "0001050446",
    whyItMatters: "Its common stock can move differently from Bitcoin because of financing, debt, preferred stock, and the market's valuation of its Bitcoin strategy.",
  },
  {
    ticker: "STRC",
    name: "Strategy Inc.",
    type: "Strategy preferred security",
    secCik: "0001050446",
    whyItMatters: "It is issued by the same company as MSTR but sits differently in the capital structure, so its income and downside profile need separate analysis.",
  },
  {
    ticker: "ASST",
    name: "Strive, Inc.",
    type: "Bitcoin treasury company",
    secCik: "0001920406",
    whyItMatters: "Its common stock depends on both Bitcoin exposure and company-specific financing and execution risk.",
  },
  {
    ticker: "FBTC",
    name: "Fidelity Wise Origin Bitcoin Fund",
    type: "Spot Bitcoin ETF",
    secCik: "0001852317",
    whyItMatters: "It is a direct Bitcoin benchmark with ETF expenses and tracking considerations, rather than company financing risk.",
  },
  {
    ticker: "IBIT",
    name: "iShares Bitcoin Trust ETF",
    type: "Spot Bitcoin ETF benchmark",
    secCik: "0001980994",
    whyItMatters: "It is a comparison benchmark for direct spot-Bitcoin exposure and ETF structure.",
  },
]

export function secCompanyUrl(cik: string) {
  return `https://www.sec.gov/edgar/browse/?CIK=${Number(cik)}`
}
