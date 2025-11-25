import type { Handler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

interface HistoricalPrice {
  ticker: string;
  timestamp: number;
  priceUSD: number;
  priceBTC: number;
  btcPriceUSD: number;
}

// Fetch current Bitcoin price
const fetchBitcoinPrice = async (): Promise<number> => {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    const data = await response.json();
    return data?.bitcoin?.usd || 0;
  } catch (e) {
    console.error('Bitcoin price fetch error', e);
    return 0;
  }
};

// Fetch current stock price from Yahoo Finance
const fetchStockPrice = async (ticker: string): Promise<number> => {
  try {
    const response = await fetch(
      `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      const result = data?.chart?.result?.[0];
      if (result?.meta?.regularMarketPrice) {
        return result.meta.regularMarketPrice;
      }
      if (result?.meta?.chartPreviousClose) {
        return result.meta.chartPreviousClose;
      }
    }
  } catch (e) {
    console.error(`Error fetching stock price for ${ticker}:`, e);
  }
  return 0;
};

// Store prices in DynamoDB
const storePrices = async (prices: HistoricalPrice[]): Promise<void> => {
  const tableName = process.env.AMPLIFY_DATA_TABLE_NAME_HISTORICALPRICE || 
                    process.env.AMPLIFY_DATA_TABLE_NAME || 
                    'HistoricalPrice';
  
  // Batch write (DynamoDB allows up to 25 items per batch)
  const batches = [];
  for (let i = 0; i < prices.length; i += 25) {
    batches.push(prices.slice(i, i + 25));
  }

  for (const batch of batches) {
    try {
      const writeRequests = batch.map(price => ({
        PutRequest: {
          Item: {
            ticker: price.ticker,
            timestamp: price.timestamp,
            priceUSD: price.priceUSD,
            priceBTC: price.priceBTC,
            btcPriceUSD: price.btcPriceUSD,
            __typename: 'HistoricalPrice',
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
          await dynamoClient.send(
            new PutCommand({
              TableName: tableName,
              Item: {
                ticker: price.ticker,
                timestamp: price.timestamp,
                priceUSD: price.priceUSD,
                priceBTC: price.priceBTC,
                btcPriceUSD: price.btcPriceUSD,
                __typename: 'HistoricalPrice',
              },
            })
          );
        } catch (putError) {
          console.error(`Error storing price for ${price.ticker}:`, putError);
        }
      }
    }
  }
};

export const handler: Handler = async (event, context) => {
  console.log('UpdateHistoricalPrices function executed', event);

  // All supported tickers
  const tickers = [
    'BTC-USD', 'MSTR', 'SMLR', 'ASST', 'FBTC', 'MARA', 'RIOT', 'COIN',
    'HUT', 'CLSK', 'BITF', 'WULF', 'CORZ', 'IREN', 'CIFR', 'BTBT'
  ];

  try {
    // Fetch current Bitcoin price
    const btcPrice = await fetchBitcoinPrice();
    if (btcPrice === 0) {
      throw new Error('Failed to fetch Bitcoin price');
    }

    const now = Date.now();
    const prices: HistoricalPrice[] = [];

    // Fetch current prices for all tickers
    for (const ticker of tickers) {
      let priceUSD = 0;

      if (ticker === 'BTC-USD') {
        priceUSD = btcPrice;
      } else {
        priceUSD = await fetchStockPrice(ticker);
      }

      if (priceUSD > 0 && btcPrice > 0) {
        const priceBTC = priceUSD / btcPrice;
        prices.push({
          ticker,
          timestamp: now,
          priceUSD,
          priceBTC,
          btcPriceUSD: btcPrice,
        });
      }
    }

    console.log(`Storing ${prices.length} current price points`);
    await storePrices(prices);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Successfully updated ${prices.length} price points`,
        timestamp: now,
        priceCount: prices.length,
      }),
    };
  } catch (error: any) {
    console.error('Error in updateHistoricalPrices:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Unknown error' }),
    };
  }
};

