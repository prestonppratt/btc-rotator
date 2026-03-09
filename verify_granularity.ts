import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import outputs from './temp_prod/amplify_outputs.json';
import type { Schema } from './amplify/data/resource';

Amplify.configure(outputs);

const client = generateClient<Schema>();

async function main() {
    console.log('Verifying data granularity in Production...');
    const tickers = ['BTC-USD', 'MSTR'];

    for (const ticker of tickers) {
        console.log(`\nChecking ${ticker}...`);
        try {
            let allData: any[] = [];
            let nextToken: string | undefined | null = undefined;

            do {
                const response: any = await client.models.HistoricalPrice.list({
                    filter: {
                        ticker: { eq: ticker },
                    },
                    authMode: 'apiKey', // Use API Key as it allows public access
                    limit: 1000,
                    nextToken,
                });

                if (response.data) {
                    allData = [...allData, ...response.data];
                }
                nextToken = response.nextToken;
            } while (nextToken);

            console.log(`Found ${allData.length} records for ${ticker}.`);

            if (allData.length > 0) {
                // Sort by timestamp
                allData.sort((a, b) => a.timestamp - b.timestamp);

                const first = new Date(allData[0].timestamp);
                const last = new Date(allData[allData.length - 1].timestamp);
                console.log(`Range: ${first.toISOString()} to ${last.toISOString()}`);

                // Check gaps
                if (allData.length > 1) {
                    const gaps = [];
                    for (let i = 1; i < allData.length; i++) {
                        const diff = (allData[i].timestamp - allData[i - 1].timestamp) / (1000 * 60 * 60); // hours
                        if (diff > 1.1) { // Allow slight variance
                            gaps.push({ from: new Date(allData[i - 1].timestamp).toISOString(), to: new Date(allData[i].timestamp).toISOString(), hours: diff.toFixed(2) });
                        }
                    }
                    if (gaps.length > 0) {
                        console.log(`Found ${gaps.length} gaps > 1 hour.`);
                        if (gaps.length < 5) console.log('Gaps:', gaps);
                    } else {
                        console.log('Granularity looks good (hourly).');
                    }
                }
            }
        } catch (error) {
            console.error(`Error checking ${ticker}:`, error);
        }
    }
}

main();
