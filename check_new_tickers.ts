import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import outputs from './amplify_outputs.json';
import type { Schema } from './amplify/data/resource';

Amplify.configure(outputs);

const client = generateClient<Schema>({ authMode: 'apiKey' });

async function checkTickerData(ticker: string) {
    console.log(`Checking data for ${ticker}...`);
    try {
        const { data: prices, errors } = await client.models.HistoricalPrice.list({
            filter: { ticker: { contains: ticker } },
            limit: 5
        });

        if (errors) {
            console.error(`Error fetching ${ticker}:`, errors);
            return;
        }

        console.log(`Found ${prices.length} records for ${ticker}.`);
        if (prices.length > 0) {
            console.log('Sample:', prices[0]);
        } else {
            console.log(`No data found for ${ticker}.`);
        }
    } catch (err) {
        console.error(`Exception checking ${ticker}:`, err);
    }
}

async function listAllTickers() {
    console.log('Listing all tickers...');
    try {
        const { data: prices } = await client.models.HistoricalPrice.list({
            limit: 1000
        });
        const tickers = new Set(prices.map(p => p.ticker));
        console.log('Found tickers:', Array.from(tickers));
    } catch (err) {
        console.error('Error listing tickers:', err);
    }
}

async function main() {
    await listAllTickers();
}

main();
