import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = 'HistoricalPrice-ro7hw3vshbhp7fxhnuwphrdioi-NONE'; // Found via list-tables

const generateMockData = (ticker: string, days: number) => {
    const data = [];
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    for (let i = 0; i < days; i++) {
        const timestamp = now - (i * oneDay);
        // Round to nearest day start to match typical daily data if needed, but ms is fine
        // Let's use exact ms timestamps as seen in the table

        // Base BTC price around $95k
        const btcPrice = 95000 + (Math.random() * 2000 - 1000);

        let priceUSD, priceBTC;

        if (ticker === 'BTC-USD') {
            priceUSD = btcPrice;
            priceBTC = 1.0;
        } else {
            // Random price for miners between $5 and $20
            priceUSD = 5.0 + (Math.random() * 15);
            priceBTC = priceUSD / btcPrice;
        }

        data.push({
            PutRequest: {
                Item: {
                    ticker,
                    timestamp,
                    priceUSD,
                    priceBTC,
                    btcPriceUSD: btcPrice,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    __typename: 'HistoricalPrice'
                }
            }
        });
    }
    return data;
};

const run = async () => {
    const tickers = [
        'BTC-USD', 'MSTR', 'SMLR', 'ASST', 'FBTC', 'MARA', 'RIOT', 'COIN',
        'HUT', 'CLSK', 'BITF', 'WULF', 'CORZ', 'IREN', 'CIFR', 'BTBT'
    ];

    for (const ticker of tickers) {
        console.log(`Generating data for ${ticker}...`);
        const items = generateMockData(ticker, 30);

        // Batch write in chunks of 25
        for (let i = 0; i < items.length; i += 25) {
            const batch = items.slice(i, i + 25);
            await docClient.send(new BatchWriteCommand({
                RequestItems: {
                    [TABLE_NAME]: batch
                }
            }));
            console.log(`Wrote batch of ${batch.length} items for ${ticker}`);
        }
    }
    console.log('Done!');
};

run().catch(console.error);
