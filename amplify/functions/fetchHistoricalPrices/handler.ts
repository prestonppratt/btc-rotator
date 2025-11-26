import type { Handler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

// Force rebuild - added createdAt/updatedAt fields

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const lambdaClient = new LambdaClient({});

interface HistoricalPrice {
  ticker: string;
  timestamp: number;
  priceUSD: number;
  priceBTC: number;
  btcPriceUSD: number;
}

// Helper delay function
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Fetch CoinGecko historical prices (generic)
const fetchCoinGeckoHistorical = async (coinId: string, days: number): Promise<Array<{ timestamp: number; price: number }>> => {
  try {
    // Add delay
    await sleep(1000);

    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.prices) {
        console.log(`DEBUG: Lambda System Time: ${new Date().toISOString()}`);
        console.log(`DEBUG: First CoinGecko Timestamp for ${coinId}: ${data.prices[0][0]} (${new Date(data.prices[0][0]).toISOString()})`);
        return data.prices.map((item: [number, number]) => ({
          timestamp: item[0],
          price: item[1],
        }));
      }
    } else {
      console.warn(`CoinGecko API error for ${coinId}: ${response.status} ${response.statusText}`);
    }
  } catch (e) {
    console.error(`Error fetching CoinGecko historical data for ${coinId}:`, e);
  }
  return [];
};

// Fetch Bitcoin historical prices (wrapper)
const fetchBitcoinHistorical = async (days: number): Promise<Array<{ timestamp: number; price: number }>> => {
  return fetchCoinGeckoHistorical('bitcoin', days);
};

// Fetch stock historical prices from Yahoo Finance (or CoinGecko fallback)
const fetchStockHistorical = async (ticker: string, days: number): Promise<Array<{ timestamp: number; price: number }>> => {
  // Special handling for stocks available on CoinGecko
  if (ticker === 'MSTR') {
    console.log('Using CoinGecko (backed-microstrategy) for MSTR');
    return fetchCoinGeckoHistorical('backed-microstrategy', days);
  }

  // Special handling for SMLR: Limit to 30 days to avoid Yahoo Finance rate limits
  if (ticker === 'SMLR') {
    console.log('Overriding SMLR days to 30 to avoid Yahoo Finance rate limits');
    days = 30;
  }
  const endDate = Math.floor(Date.now() / 1000);
  const startDate = endDate - (days * 24 * 60 * 60);
  const interval = days > 90 ? '1d' : '1h'; // 1d for longer ranges (>90 days), 1h for shorter

  try {
    // Add delay to avoid rate limits
    await sleep(1000);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${startDate}&period2=${endDate}&interval=${interval}`,
      {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }
    );
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const result = data?.chart?.result?.[0];
      if (result?.timestamp && result?.indicators?.quote?.[0]?.close) {
        const timestamps = result.timestamp;
        const closes = result.indicators.quote[0].close;
        return timestamps
          .map((ts: number, i: number) => ({
            timestamp: ts * 1000, // Convert to milliseconds
            price: closes[i] || 0,
          }))
          .filter((d: { price: number }) => d.price > 0);
      } else {
        console.warn(`Yahoo Finance data missing for ${ticker}:`, JSON.stringify(data).substring(0, 200));
      }
    } else {
      console.warn(`Yahoo Finance API error for ${ticker}: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.warn(`Response body: ${text.substring(0, 500)}`);
    }
  } catch (e) {
    console.error(`Error fetching historical data for ${ticker}:`, e);
  }
  return [];
};

// Store prices in DynamoDB using Amplify's table structure
const storePrices = async (prices: HistoricalPrice[]): Promise<void> => {
  // Get table name from environment (Amplify sets this)
  // Format: HistoricalPrice-<appId>-<env>
  const tableName = process.env.AMPLIFY_DATA_TABLE_NAME_HISTORICALPRICE ||
    process.env.AMPLIFY_DATA_TABLE_NAME ||
    'HistoricalPrice';

  console.log(`Storing prices to table: ${tableName}`);

  // Batch write (DynamoDB allows up to 25 items per batch)
  const batches = [];
  for (let i = 0; i < prices.length; i += 25) {
    batches.push(prices.slice(i, i + 25));
  }

  for (const batch of batches) {
    try {
      const now = new Date().toISOString();
      const writeRequests = batch.map(price => ({
        PutRequest: {
          Item: {
            ticker: price.ticker,
            timestamp: price.timestamp,
            priceUSD: price.priceUSD,
            priceBTC: price.priceBTC,
            btcPriceUSD: price.btcPriceUSD,
            createdAt: now,
            updatedAt: now,
            __typename: 'HistoricalPrice', // Amplify requires this
          },
        },
      }));

      await dynamoClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [tableName]: writeRequests,
          },
        })
      );
    } catch (e) {
      console.error(`Error storing batch:`, e);
      // Fallback to individual puts
      for (const price of batch) {
        try {
          const now = new Date().toISOString();
          await dynamoClient.send(
            new PutCommand({
              TableName: tableName,
              Item: {
                ticker: price.ticker,
                timestamp: price.timestamp,
                priceUSD: price.priceUSD,
                priceBTC: price.priceBTC,
                btcPriceUSD: price.btcPriceUSD,
                createdAt: now,
                updatedAt: now,
                __typename: 'HistoricalPrice',
              },
            })
          );
        } catch (putError) {
          console.error(`Error storing price for ${price.ticker} at ${price.timestamp}:`, putError);
        }
      }
    }
  }
};

// Helper delay function (already defined earlier as sleep)

// Batching configuration – adjust as needed
const BATCH_SIZE = 4; // number of tickers per Lambda invocation
const BATCH_DELAY_MS = 1000; // 1 second between batches to prevent timeout

/**
 * Core Lambda handler. Supports self‑invocation to pace API calls over many hours.
 * The event may contain `remainingTickers` – an array of tickers that still need processing.
 */
export const handler: Handler = async (event, _context) => {
  console.log('fetchHistoricalPrices invoked', JSON.stringify(event));

  const args = event.arguments || {};
  const allTickers = args.tickers || [
    'BTC-USD', 'MSTR', 'SMLR', 'ASST', 'FBTC', 'MARA', 'RIOT', 'COIN',
    'HUT', 'CLSK', 'BITF', 'WULF', 'CORZ', 'IREN', 'CIFR', 'BTBT',
  ];
  const days = args.days || 365;
  const remaining: string[] = args.remainingTickers || allTickers;

  // Security: Cap the number of tickers to prevent abuse/timeout
  const MAX_TICKERS = 50;
  if (allTickers.length > MAX_TICKERS) {
    throw new Error(`Too many tickers provided. Max allowed: ${MAX_TICKERS}`);
  }

  // Security: Cap the number of days
  const MAX_DAYS = 2000;
  if (days > MAX_DAYS) {
    console.warn(`Requested days (${days}) exceeds limit. Capping at ${MAX_DAYS}.`);
  }
  const safeDays = Math.min(Math.max(1, days), MAX_DAYS);

  // Take a slice for this batch
  const currentBatch = remaining.slice(0, BATCH_SIZE);
  const nextBatch = remaining.slice(BATCH_SIZE);

  console.log(`Processing batch: ${currentBatch.join(', ')}`);

  // ---- Fetch Bitcoin once (needed for all tickers) ----
  const btcHistorical = await fetchBitcoinHistorical(days);
  if (btcHistorical.length === 0) {
    throw new Error('Failed to fetch Bitcoin historical data');
  }
  const btcPriceMap = new Map<number, number>();
  btcHistorical.forEach(({ timestamp, price }) => btcPriceMap.set(timestamp, price));

  const batchPrices: HistoricalPrice[] = [];

  for (const ticker of currentBatch) {
    let hist: Array<{ timestamp: number; price: number }> = [];

    // Security: Validate ticker format (alphanumeric + hyphens only) to prevent injection
    if (!/^[A-Z0-9.-]+$/.test(ticker)) {
      console.warn(`Skipping invalid ticker format: ${ticker}`);
      continue;
    }

    if (ticker === 'BTC-USD') {
      hist = btcHistorical;
    } else {
      hist = await fetchStockHistorical(ticker, days);
    }
    console.log(`Fetched ${hist.length} points for ${ticker}`);
    for (const { timestamp, price } of hist) {
      let btcPrice = 0;
      const maxDiff = days <= 1 ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
      if (btcPriceMap.has(timestamp)) {
        btcPrice = btcPriceMap.get(timestamp)!;
      } else {
        let closest = 0;
        let minDiff = Infinity;
        for (const [btcTs, btcP] of btcPriceMap.entries()) {
          const diff = Math.abs(btcTs - timestamp);
          if (diff < minDiff && diff <= maxDiff) {
            minDiff = diff;
            closest = btcTs;
          }
        }
        if (closest) btcPrice = btcPriceMap.get(closest)!;
      }
      if (btcPrice > 0 && price > 0) {
        const priceBTC = price / btcPrice;
        batchPrices.push({ ticker, timestamp, priceUSD: price, priceBTC, btcPriceUSD: btcPrice });
      }
    }
  }

  if (batchPrices.length > 0) {
    await storePrices(batchPrices);
    console.log(`Stored ${batchPrices.length} price points for this batch`);
  } else {
    console.warn('No price points collected in this batch');
  }

  // Schedule next batch if needed
  if (nextBatch.length > 0) {
    console.log(`Scheduling next batch of ${nextBatch.length} tickers after delay`);
    // Wait before invoking – this keeps the current Lambda within its timeout (keep delay short)
    await sleep(BATCH_DELAY_MS);
    const payload = {
      arguments: {
        tickers: allTickers,
        days,
        remainingTickers: nextBatch,
      },
    };
    const lambdaClient = new LambdaClient({});
    const cmd = new InvokeCommand({
      FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME!,
      InvocationType: 'Event', // async fire‑and‑forget
      Payload: Buffer.from(JSON.stringify(payload)),
    });
    await lambdaClient.send(cmd);
    console.log('Invoked next batch');
  } else {
    console.log('All tickers processed – work complete');
  }

  return `Batch processed: ${currentBatch.join(', ')}`;
};

