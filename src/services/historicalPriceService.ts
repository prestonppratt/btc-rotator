import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getCurrentUser } from 'aws-amplify/auth';
import type { Schema } from '../../amplify/data/resource';


// Initialize Amplify API client
const client = generateClient<Schema>();

export interface HistoricalPrice {
  ticker: string;
  timestamp: number;
  priceUSD: number;
  priceBTC: number;
  btcPriceUSD: number;
}

// Fetch historical prices from backend
export const fetchHistoricalPricesFromBackend = async (
  ticker: string,
  startTimestamp?: number,
  endTimestamp?: number,
): Promise<HistoricalPrice[]> => {
  try {
    // Determine auth mode based on user session
    let authMode: 'userPool' | 'apiKey' = 'apiKey';
    try {
      await getCurrentUser();
      authMode = 'userPool';
    } catch (e) {
      // User is not signed in, use API Key (Public)
      authMode = 'apiKey';
    }

    console.log(`Fetching ${ticker} with authMode: ${authMode}`);

    let allData: any[] = [];
    let nextToken: string | undefined | null = undefined;

    do {
      const response: any = await client.models.HistoricalPrice.list({
        filter: {
          ticker: { eq: ticker },
        },
        authMode,
        limit: 1000, // Fetch max allowed per page
        nextToken,
      });

      if (response.errors) {
        console.error('Error fetching historical prices:', JSON.stringify(response.errors, null, 2));
        // If we have partial data, maybe continue? But for now, let's stop on error
        break;
      }

      if (response.data) {
        allData = [...allData, ...response.data];
      }

      nextToken = response.nextToken;
    } while (nextToken);

    const data = allData;

    if (data.length === 0) {
      console.warn(`No data found for ${ticker} with filter.`);
    }

    // Filter by timestamp range client-side
    let results = (data || []).map((item: any) => ({
      ticker: item.ticker,
      timestamp: item.timestamp,
      priceUSD: item.priceUSD,
      priceBTC: item.priceBTC,
      btcPriceUSD: item.btcPriceUSD,
    }));

    // Apply timestamp filters if provided
    if (startTimestamp) {
      results = results.filter(item => item.timestamp >= startTimestamp);
    }
    if (endTimestamp) {
      results = results.filter(item => item.timestamp <= endTimestamp);
    }

    console.log(`✓ Fetched ${results.length} prices for ${ticker} from backend`);
    return results;
  } catch (error) {
    console.error('Error in fetchHistoricalPricesFromBackend:', error);
    return [];
  }
};

// Trigger fetching and storing of historical prices (admin function)
export const triggerFetchHistoricalPrices = async (
  tickers: string[],
  days: number = 365
): Promise<string> => {
  try {
    console.log(`Triggering fetchHistoricalPrices for tickers: ${tickers.join(', ')}, days: ${days}`);

    // Determine auth mode based on user session
    let authMode: 'userPool' | 'apiKey' = 'apiKey';
    try {
      await getCurrentUser();
      authMode = 'userPool';
    } catch (e) {
      // User is not signed in, use API Key (Public)
      authMode = 'apiKey';
    }

    const response = await client.mutations.fetchHistoricalPrices({
      tickers,
      days,
    }, {
      authMode
    });

    if (response.errors) {
      console.error('Error triggering fetchHistoricalPrices:', response.errors);
      throw new Error(response.errors.map(e => e.message).join(', '));
    }

    console.log('Successfully triggered fetchHistoricalPrices:', response.data);
    return response.data || 'Triggered successfully';
  } catch (error: any) {
    console.error('Error in triggerFetchHistoricalPrices:', error);
    throw error;
  }
};
