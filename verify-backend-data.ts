import { generateClient } from 'aws-amplify/data';
import type { Schema } from './amplify/data/resource';
import { Amplify } from 'aws-amplify';
import outputs from './amplify_outputs.json';

Amplify.configure(outputs);

const client = generateClient<Schema>();

async function verifyBackendData() {
    console.log('Querying backend for historical price data...\n');

    try {
        // Query for Bitcoin data from the last year
        const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);

        const { data: btcData } = await client.models.HistoricalPrice.list({
            filter: {
                ticker: { eq: 'BTC-USD' },
                timestamp: { ge: oneYearAgo }
            },
            limit: 1000
        });

        console.log(`Found ${btcData?.length || 0} Bitcoin price records`);

        if (btcData && btcData.length > 0) {
            // Sort by timestamp
            const sorted = btcData.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

            console.log('\n=== BITCOIN PRICE DATA (Last Year) ===\n');
            console.log('First 10 records:');
            sorted.slice(0, 10).forEach(record => {
                const date = new Date(record.timestamp || 0).toLocaleDateString();
                console.log(`${date}: $${record.priceUSD?.toFixed(2)} (₿${record.priceBTC?.toFixed(8)})`);
            });

            console.log('\n...\n');
            console.log('Last 10 records:');
            sorted.slice(-10).forEach(record => {
                const date = new Date(record.timestamp || 0).toLocaleDateString();
                console.log(`${date}: $${record.priceUSD?.toFixed(2)} (₿${record.priceBTC?.toFixed(8)})`);
            });

            // Calculate date range
            const firstDate = new Date(sorted[0].timestamp || 0);
            const lastDate = new Date(sorted[sorted.length - 1].timestamp || 0);
            const daysCovered = Math.floor((lastDate.getTime() - firstDate.getTime()) / (24 * 60 * 60 * 1000));

            console.log(`\n=== SUMMARY ===`);
            console.log(`Total records: ${sorted.length}`);
            console.log(`Date range: ${firstDate.toLocaleDateString()} to ${lastDate.toLocaleDateString()}`);
            console.log(`Days covered: ${daysCovered}`);
            console.log(`Price range: $${Math.min(...sorted.map(r => r.priceUSD || 0)).toFixed(2)} - $${Math.max(...sorted.map(r => r.priceUSD || 0)).toFixed(2)}`);
        } else {
            console.log('⚠️ No Bitcoin data found in backend. You may need to click "Refresh Backend Data" button.');
        }

        // Check other tickers
        console.log('\n=== CHECKING OTHER ASSETS ===\n');
        const tickers = ['MSTR', 'COIN', 'MARA', 'RIOT'];

        for (const ticker of tickers) {
            const { data: tickerData } = await client.models.HistoricalPrice.list({
                filter: {
                    ticker: { eq: ticker },
                    timestamp: { ge: oneYearAgo }
                },
                limit: 10
            });

            console.log(`${ticker}: ${tickerData?.length || 0} records found`);
        }

    } catch (error) {
        console.error('Error querying backend:', error);
    }
}

verifyBackendData();
