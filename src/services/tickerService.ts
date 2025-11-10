// Frontend-only MVP - backend will be added later
import { SUPPORTED_TICKERS } from '../constants/tickers';

export interface Ticker {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
}

export async function fetchTickers(): Promise<Ticker[]> {
  // Stub for MVP - return mock data
  return SUPPORTED_TICKERS.map((ticker) => ({
    symbol: ticker,
    price: 50000 + Math.random() * 10000,
    change24h: (Math.random() - 0.5) * 1000,
    changePercent24h: (Math.random() - 0.5) * 5,
  }));
}
