import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from './amplify/data/resource';
import outputs from './amplify_outputs.json';

Amplify.configure(outputs);

const client = generateClient<Schema>();

async function testMSTRQuery() {
    try {
        console.log('Testing MSTR data query with API Key auth...');

        const response = await client.models.HistoricalPrice.list({
            filter: {
                ticker: { eq: 'MSTR' },
            },
            authMode: 'apiKey',
            limit: 10,
        });

        console.log('Response errors:', response.errors);
        console.log('Response data count:', response.data?.length || 0);

        if (response.data && response.data.length > 0) {
            console.log('Sample MSTR data point:', response.data[0]);
            console.log('✅ MSTR data is accessible via GraphQL!');
        } else {
            console.log('❌ No MSTR data returned from GraphQL query');
        }
    } catch (error) {
        console.error('Error querying MSTR data:', error);
    }
}

testMSTRQuery();
