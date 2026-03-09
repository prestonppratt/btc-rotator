import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
const TABLE_NAME = 'HistoricalPrice-ro7hw3vshbhp7fxhnuwphrdioi-NONE';

async function checkGranularity() {
    // Get BTC data
    const btcResponse = await client.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'ticker = :ticker',
        ExpressionAttributeValues: {
            ':ticker': 'BTC-USD',
        },
        Limit: 1000,
    }));

    // Get MSTR data
    const mstrResponse = await client.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'ticker = :ticker',
        ExpressionAttributeValues: {
            ':ticker': 'MSTR',
        },
        Limit: 1000,
    }));

    const btcData = btcResponse.Items || [];
    const mstrData = mstrResponse.Items || [];

    console.log(`\n=== Data Point Counts ===`);
    console.log(`BTC-USD: ${btcData.length} data points`);
    console.log(`MSTR: ${mstrData.length} data points`);

    // Calculate time intervals between consecutive points
    const calculateIntervals = (data: any[], name: string) => {
        if (data.length < 2) return;

        const sorted = data.sort((a, b) => a.timestamp - b.timestamp);
        const intervals: number[] = [];

        for (let i = 1; i < sorted.length; i++) {
            const interval = sorted[i].timestamp - sorted[i - 1].timestamp;
            intervals.push(interval);
        }

        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const minInterval = Math.min(...intervals);
        const maxInterval = Math.max(...intervals);

        console.log(`\n=== ${name} Granularity ===`);
        console.log(`Average interval: ${(avgInterval / 1000 / 60).toFixed(2)} minutes`);
        console.log(`Min interval: ${(minInterval / 1000 / 60).toFixed(2)} minutes`);
        console.log(`Max interval: ${(maxInterval / 1000 / 60).toFixed(2)} minutes`);
        console.log(`Median interval: ${(intervals.sort((a, b) => a - b)[Math.floor(intervals.length / 2)] / 1000 / 60).toFixed(2)} minutes`);

        // Show first few timestamps
        console.log(`\nFirst 5 timestamps:`);
        sorted.slice(0, 5).forEach((item, i) => {
            const date = new Date(item.timestamp);
            console.log(`  ${i + 1}. ${date.toISOString()} (${item.timestamp})`);
        });
    };

    calculateIntervals(btcData, 'BTC-USD');
    calculateIntervals(mstrData, 'MSTR');

    // Check for overlapping time periods
    if (btcData.length > 0 && mstrData.length > 0) {
        const btcSorted = btcData.sort((a, b) => a.timestamp - b.timestamp);
        const mstrSorted = mstrData.sort((a, b) => a.timestamp - b.timestamp);

        const btcStart = new Date(btcSorted[0].timestamp);
        const btcEnd = new Date(btcSorted[btcSorted.length - 1].timestamp);
        const mstrStart = new Date(mstrSorted[0].timestamp);
        const mstrEnd = new Date(mstrSorted[mstrSorted.length - 1].timestamp);

        console.log(`\n=== Date Ranges ===`);
        console.log(`BTC-USD: ${btcStart.toISOString()} to ${btcEnd.toISOString()}`);
        console.log(`MSTR: ${mstrStart.toISOString()} to ${mstrEnd.toISOString()}`);

        const overlapStart = Math.max(btcSorted[0].timestamp, mstrSorted[0].timestamp);
        const overlapEnd = Math.min(btcSorted[btcSorted.length - 1].timestamp, mstrSorted[mstrSorted.length - 1].timestamp);

        if (overlapStart < overlapEnd) {
            const overlapDays = (overlapEnd - overlapStart) / (1000 * 60 * 60 * 24);
            console.log(`\nOverlapping period: ${overlapDays.toFixed(1)} days`);
        } else {
            console.log(`\n⚠️ No overlapping data period!`);
        }
    }
}

checkGranularity().catch(console.error);
