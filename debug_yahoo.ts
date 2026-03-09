import yahooFinance from 'yahoo-finance2';

async function fetchTicker(ticker: string) {
    console.log(`Fetching ${ticker}...`);
    try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 90);

        const queryOptions = {
            period1: startDate,
            period2: endDate,
            interval: '1d' as const
        };

        const result = await yahooFinance.historical(ticker, queryOptions);
        console.log(`Success for ${ticker}! Found ${result.length} records.`);
        if (result.length > 0) {
            console.log('Sample:', result[0]);
        }
    } catch (error) {
        console.error(`Error fetching ${ticker}:`, error);
    }
}

async function main() {
    await fetchTicker('SMLR');
    await fetchTicker('ASST');
}

main();
