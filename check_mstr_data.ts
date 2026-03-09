import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "HistoricalPrice-ro7hw3vshbhp7fxhnuwphrdioi-NONE";

async function checkMSTRData() {
    try {
        // Get Min Timestamp for MSTR
        const minCommand = new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "ticker = :ticker",
            ExpressionAttributeValues: {
                ":ticker": "MSTR",
            },
            ScanIndexForward: true, // Ascending order
            Limit: 1,
        });

        const minResult = await docClient.send(minCommand);
        const minItem = minResult.Items?.[0];

        // Get Max Timestamp for MSTR
        const maxCommand = new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "ticker = :ticker",
            ExpressionAttributeValues: {
                ":ticker": "MSTR",
            },
            ScanIndexForward: false, // Descending order
            Limit: 1,
        });

        const maxResult = await docClient.send(maxCommand);
        const maxItem = maxResult.Items?.[0];

        if (minItem && maxItem) {
            const minDate = new Date(minItem.timestamp);
            const maxDate = new Date(maxItem.timestamp);

            console.log(`MSTR Data Range:`);
            console.log(`Earliest: ${minDate.toISOString()} (${minItem.timestamp})`);
            console.log(`Latest:   ${maxDate.toISOString()} (${maxItem.timestamp})`);

            const diffTime = Math.abs(maxDate.getTime() - minDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            console.log(`Total Days: ${diffDays}`);
        } else {
            console.log("No data found for MSTR");
        }

    } catch (error) {
        console.error("Error checking MSTR data:", error);
    }
}

checkMSTRData();
