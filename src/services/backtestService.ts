import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

export interface BacktestDataPoint {
  date: string;
  rotatorValue: number;
  btcValue: number;
  position?: string;
  topTicker?: string;
  scoreGap?: number;
}

export interface BacktestResponse {
  cached: boolean;
  cacheTime?: string;
  results: BacktestDataPoint[];
  summary?: {
    startDate: string;
    endDate: string;
    initialCapital: number;
    finalRotatorValue: number;
    finalBtcValue: number;
    totalReturn: number;
    btcReturn: number;
  };
}

export async function fetchBacktestData(): Promise<BacktestResponse> {
  try {
    // Call backtest Lambda via API Gateway
    // You'll need to set up an API Gateway endpoint or use AppSync
    const response = await fetch('/api/backtest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching backtest data:', error);
    throw error;
  }
}

