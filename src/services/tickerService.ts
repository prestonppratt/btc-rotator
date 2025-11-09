import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { SUPPORTED_TICKERS } from '../constants/tickers';

const client = generateClient<Schema>();

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

export async function fetchTickerData(ticker: string): Promise<TickerData> {
  // Validate ticker is supported
  if (!SUPPORTED_TICKERS.includes(ticker as any)) {
    throw new Error(`Ticker ${ticker} is not supported`);
  }

  // For now, use a mock API or direct fetch
  // In production, this would call your Lambda function via AppSync
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.chart?.result?.[0]) {
      const result = data.chart.result[0];
      const meta = result.meta || {};

      return {
        symbol: ticker,
        name: meta.longName || ticker,
        price: meta.regularMarketPrice || 0,
        change24h: meta.regularMarketChange || 0,
        changePercent24h: meta.regularMarketChangePercent || 0,
        volume: meta.regularMarketVolume || 0,
        marketCap: meta.marketCap || 0,
        lastUpdated: meta.regularMarketTime || Math.floor(Date.now() / 1000),
      };
    }

    throw new Error('No data returned from API');
  } catch (error) {
    console.error('Error fetching ticker data:', error);
    throw error;
  }
}

export async function saveRotationOrder(
  userId: string,
  rotationOrder: string[]
): Promise<void> {
  // Save rotation order to DynamoDB via AppSync
  // This would be implemented with your GraphQL mutations
  console.log('Saving rotation order:', { userId, rotationOrder });
}

export async function getRotationHistory(userId: string) {
  // Fetch rotation history from DynamoDB via AppSync
  // This would be implemented with your GraphQL queries
  console.log('Fetching rotation history for:', userId);
  return [];
}

