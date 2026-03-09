
import https from 'https';

const fetchUrl = (url: string) => {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        };
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    console.error('Error parsing JSON:', data.substring(0, 100));
                    reject(e);
                }
            });
            res.on('error', reject);
        }).on('error', reject);
    });
};

const checkPrices = async () => {
    try {
        console.log('Fetching BTC historical data from CoinGecko (365 days)...');
        const btcHistory: any = await fetchUrl('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=365');

        if (btcHistory.prices) {
            const prices = btcHistory.prices.map((p: any) => p[1]);
            const maxPrice = Math.max(...prices);
            const minPrice = Math.min(...prices);
            const currentPrice = prices[prices.length - 1];

            console.log(`BTC Max (365d): $${maxPrice}`);
            console.log(`BTC Min (365d): $${minPrice}`);
            console.log(`BTC Current: $${currentPrice}`);
        } else {
            console.log('No BTC history found', JSON.stringify(btcHistory));
        }

        console.log('Fetching BTC price from CoinGecko...');
        const btcData: any = await fetchUrl('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_last_updated_at=true');
        console.log('CoinGecko BTC:', JSON.stringify(btcData, null, 2));

        console.log('\nFetching MSTR price from Yahoo Finance...');
        // Yahoo Finance chart API
        const yahooData: any = await fetchUrl('https://query1.finance.yahoo.com/v8/finance/chart/MSTR?interval=1d&range=5d');
        const result = yahooData?.chart?.result?.[0];
        if (result) {
            const quote = result.indicators.quote[0];
            const latestPrice = quote.close[quote.close.length - 1];
            const latestTime = new Date(result.timestamp[result.timestamp.length - 1] * 1000).toISOString();
            console.log(`Yahoo MSTR: ${latestPrice} USD at ${latestTime}`);
        } else {
            console.log('Yahoo MSTR: No data found', JSON.stringify(yahooData));
        }

    } catch (error) {
        console.error('Error fetching prices:', error);
    }
};

checkPrices();
