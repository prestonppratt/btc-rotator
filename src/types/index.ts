export interface TickerData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume: number;
  marketCap: number;
  lastUpdated: number;
}

export interface UserRotation {
  id: string;
  userId: string;
  tickerSymbol: string;
  rotationOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface RotationHistory {
  id: string;
  userId: string;
  fromTicker: string;
  toTicker: string;
  timestamp: number;
  reason?: string;
}

