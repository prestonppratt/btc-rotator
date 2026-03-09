import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "HistoricalPrice-ro7hw3vshbhp7fxhnuwphrdioi-NONE"; // Correct table name found via aws dynamodb list-tables

async function checkDataRange() {
    try {
        // Fetch all data for BTC-USD (using Query instead of Scan for efficiency if possible, but Scan is easier for min/max if PK is ticker)
        // Actually, PK is ticker, SK is timestamp. So we can query with Limit 1 and ScanIndexForward true/false to get min/max.

        // Get Min Timestamp
        const minCommand = new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "ticker = :ticker",
            ExpressionAttributeValues: {
                ":ticker": "BTC-USD",
            },
            ScanIndexForward: true, // Ascending order
            Limit: 1,
        });

        const minResult = await docClient.send(minCommand);
        const minItem = minResult.Items?.[0];

        // Get Max Timestamp
        const maxCommand = new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "ticker = :ticker",
            ExpressionAttributeValues: {
                ":ticker": "BTC-USD",
            },
            ScanIndexForward: false, // Descending order
            Limit: 1,
        });

        const maxResult = await docClient.send(maxCommand);
        const maxItem = maxResult.Items?.[0];

        if (minItem && maxItem) {
            const minDate = new Date(minItem.timestamp);
            const maxDate = new Date(maxItem.timestamp);

            console.log(`BTC-USD Data Range:`);
            console.log(`Earliest: ${minDate.toISOString()} (${minItem.timestamp})`);
            console.log(`Latest:   ${maxDate.toISOString()} (${maxItem.timestamp})`);

            const diffTime = Math.abs(maxDate.getTime() - minDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            console.log(`Total Days: ${diffDays}`);
        } else {
            console.log("No data found for BTC-USD");
        }

    } catch (error) {
        console.error("Error checking data range:", error);
    }
}

checkDataRange();
