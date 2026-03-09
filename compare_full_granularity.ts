import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
const TABLE_NAME = 'HistoricalPrice-ro7hw3vshbhp7fxhnuwphrdioi-NONE';

async function getAllData(ticker: string) {
    let allItems: any[] = [];
    let lastEvaluatedKey: any = undefined;

    do {
        const response = await client.send(new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'ticker = :ticker',
            ExpressionAttributeValues: {
                ':ticker': ticker,
            },
            ExclusiveStartKey: lastEvaluatedKey,
        }));

        if (response.Items) {
            allItems = allItems.concat(response.Items);
        }
        lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return allItems;
}

async function compareGranularity() {
    console.log('Fetching all BTC-USD data...');
    const btcData = await getAllData('BTC-USD');

    console.log('Fetching all MSTR data...');
    const mstrData = await getAllData('MSTR');

    console.log(`\n=== Total Data Points ===`);
    console.log(`BTC-USD: ${btcData.length} total data points`);
    console.log(`MSTR: ${mstrData.length} total data points`);

    // Sort by timestamp
    const btcSorted = btcData.sort((a, b) => a.timestamp - b.timestamp);
    const mstrSorted = mstrData.sort((a, b) => a.timestamp - b.timestamp);

    // Calculate intervals
    const calculateStats = (data: any[], name: string) => {
        if (data.length < 2) return;

        const intervals: number[] = [];
        for (let i = 1; i < data.length; i++) {
            const interval = data[i].timestamp - data[i - 1].timestamp;
            intervals.push(interval);
        }

        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const minInterval = Math.min(...intervals);
        const maxInterval = Math.max(...intervals);
        const sortedIntervals = intervals.sort((a, b) => a - b);
        const medianInterval = sortedIntervals[Math.floor(sortedIntervals.length / 2)];

        console.log(`\n=== ${name} Statistics ===`);
        console.log(`Total points: ${data.length}`);
        console.log(`Date range: ${new Date(data[0].timestamp).toISOString()} to ${new Date(data[data.length - 1].timestamp).toISOString()}`);
        console.log(`Average interval: ${(avgInterval / 1000 / 60).toFixed(2)} minutes`);
        console.log(`Median interval: ${(medianInterval / 1000 / 60).toFixed(2)} minutes`);
        console.log(`Min interval: ${(minInterval / 1000 / 60).toFixed(2)} minutes`);
        console.log(`Max interval: ${(maxInterval / 1000 / 60).toFixed(2)} minutes`);

        // Count intervals by range
        const hourly = intervals.filter(i => i >= 50 * 60 * 1000 && i <= 70 * 60 * 1000).length;
        const daily = intervals.filter(i => i >= 20 * 60 * 60 * 1000 && i <= 28 * 60 * 60 * 1000).length;
        const other = intervals.length - hourly - daily;

        console.log(`\nInterval distribution:`);
        console.log(`  ~1 hour (50-70 min): ${hourly} (${(hourly / intervals.length * 100).toFixed(1)}%)`);
        console.log(`  ~1 day (20-28 hrs): ${daily} (${(daily / intervals.length * 100).toFixed(1)}%)`);
        console.log(`  Other: ${other} (${(other / intervals.length * 100).toFixed(1)}%)`);
    };

    calculateStats(btcSorted, 'BTC-USD');
    calculateStats(mstrSorted, 'MSTR');

    // Check for overlapping period
    const overlapStart = Math.max(btcSorted[0].timestamp, mstrSorted[0].timestamp);
    const overlapEnd = Math.min(btcSorted[btcSorted.length - 1].timestamp, mstrSorted[mstrSorted.length - 1].timestamp);

    if (overlapStart < overlapEnd) {
        const overlapDays = (overlapEnd - overlapStart) / (1000 * 60 * 60 * 24);
        console.log(`\n=== Overlap ===`);
        console.log(`Overlapping period: ${overlapDays.toFixed(1)} days`);
        console.log(`From: ${new Date(overlapStart).toISOString()}`);
        console.log(`To: ${new Date(overlapEnd).toISOString()}`);
    }
}

compareGranularity().catch(console.error);
