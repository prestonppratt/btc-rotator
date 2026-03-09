import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import outputs from './temp_prod/amplify_outputs.json';
import type { Schema } from './amplify/data/resource';

Amplify.configure(outputs);

const client = generateClient<Schema>();

async function main() {
    console.log('Testing fetchHistoricalPrices mutation with API Key auth...');

    try {
        const response = await client.mutations.fetchHistoricalPrices({
            tickers: ['BTC-USD'],
            days: 1,
        }, {
            authMode: 'apiKey'
        });

        if (response.errors) {
            console.error('❌ Error:', JSON.stringify(response.errors, null, 2));
        } else {
            console.log('✅ Success:', response.data);
        }
    } catch (error) {
        console.error('❌ Exception (API Key):', error);
    }

    console.log('\nTesting fetchHistoricalPrices mutation with IAM (Guest) auth...');
    try {
        const response = await client.mutations.fetchHistoricalPrices({
            tickers: ['BTC-USD'],
            days: 1,
        }, {
            authMode: 'iam'
        });

        if (response.errors) {
            console.error('❌ Error (IAM):', JSON.stringify(response.errors, null, 2));
        } else {
            console.log('✅ Success (IAM):', response.data);
        }
    } catch (error) {
        console.error('❌ Exception (IAM):', error);
    }
}

main();
