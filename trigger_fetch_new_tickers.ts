import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import outputs from './amplify_outputs.json';
import type { Schema } from './amplify/data/resource';

Amplify.configure(outputs);

const client = generateClient<Schema>({ authMode: 'apiKey' });

async function triggerFetch() {
    console.log('Triggering fetch for SMLR and ASST...');
    try {
        const response = await client.mutations.fetchHistoricalPrices({
            tickers: ['FBTC'],
            days: 365
        });
        console.log('Fetch triggered successfully:', response);
    } catch (error) {
        console.error('Error triggering fetch:', error);
    }
}

triggerFetch();
