import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// Hardcoded table name from previous steps
const TABLE_NAME = 'HistoricalPrice-ro7hw3vshbhp7fxhnuwphrdioi-NONE';

const clearTable = async () => {
    console.log(`Scanning table ${TABLE_NAME}...`);

    let itemsToDelete: any[] = [];
    let lastEvaluatedKey;

    do {
        const command = new ScanCommand({
            TableName: TABLE_NAME,
            ProjectionExpression: 'ticker, #ts',
            ExpressionAttributeNames: {
                '#ts': 'timestamp',
            },
            ExclusiveStartKey: lastEvaluatedKey,
        });

        const response = await docClient.send(command);
        if (response.Items) {
            itemsToDelete = [...itemsToDelete, ...response.Items];
        }
        lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`Found ${itemsToDelete.length} items to delete.`);

    if (itemsToDelete.length === 0) {
        console.log('Table is already empty.');
        return;
    }

    // Batch delete in chunks of 25
    for (let i = 0; i < itemsToDelete.length; i += 25) {
        const batch = itemsToDelete.slice(i, i + 25);
        const deleteRequests = batch.map((item) => ({
            DeleteRequest: {
                Key: {
                    ticker: item.ticker,
                    timestamp: item.timestamp,
                },
            },
        }));

        try {
            await docClient.send(
                new BatchWriteCommand({
                    RequestItems: {
                        [TABLE_NAME]: deleteRequests,
                    },
                })
            );
            console.log(`Deleted batch ${i / 25 + 1} of ${Math.ceil(itemsToDelete.length / 25)}`);
        } catch (error) {
            console.error('Error deleting batch:', error);
        }
    }

    console.log('Table cleared successfully.');
};

clearTable().catch(console.error);
