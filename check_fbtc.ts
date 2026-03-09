import yahooFinance from 'yahoo-finance2';

async function checkFBTC() {
    console.log('Checking FBTC availability...');
    try {
        const result = await yahooFinance.chart('FBTC', {
            period1: '2024-01-01', // FBTC launched in Jan 2024
            interval: '1d'
        });

        if (result && result.quotes && result.quotes.length > 0) {
            console.log(`Success! Found ${result.quotes.length} records for FBTC.`);
            console.log('Sample:', result.quotes[0]);
        } else {
            console.log('No data found for FBTC.');
        }
    } catch (error) {
        console.error('Error fetching FBTC:', error);
    }
}

checkFBTC();
