import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import outputs from './amplify_outputs.json';
import type { Schema } from './amplify/data/resource';

Amplify.configure(outputs);

const client = generateClient<Schema>({ authMode: 'apiKey' });

async function checkFBTCData() {
    console.log('Checking data for FBTC...');
    try {
        const { data: prices } = await client.models.HistoricalPrice.list({
            filter: { ticker: { eq: 'FBTC' } },
            limit: 1000
        });

        if (prices.length === 0) {
            console.log('No data found for FBTC.');
            return;
        }

        const sorted = prices.sort((a, b) => a.timestamp - b.timestamp);
        const oldest = sorted[0];
        const newest = sorted[sorted.length - 1];

        console.log(`Found ${prices.length} records for FBTC.`);
        console.log(`Oldest: ${new Date(oldest.timestamp).toISOString()} (${oldest.timestamp})`);
        console.log(`Newest: ${new Date(newest.timestamp).toISOString()} (${newest.timestamp})`);

        const days = (newest.timestamp - oldest.timestamp) / (1000 * 60 * 60 * 24);
        console.log(`Range: ${days.toFixed(2)} days`);

    } catch (err) {
        console.error('Error checking FBTC:', err);
    }
}

checkFBTCData();
