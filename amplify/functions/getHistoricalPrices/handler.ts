import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import type { Schema } from '../../data/resource';

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.AMPLIFY_DATA_TABLE_NAME_HISTORICALPRICE;

export const handler: Schema['getHistoricalPrices']['functionHandler'] = async (event) => {
    const { ticker, days } = event.arguments;

    if (!TABLE_NAME) {
        throw new Error('Table name not defined');
    }

    const endTimestamp = Date.now();
    const startTimestamp = days ? endTimestamp - (days * 24 * 60 * 60 * 1000) : 0;

    try {
        const command = new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'ticker = :ticker AND #ts >= :start',
            ExpressionAttributeNames: {
                '#ts': 'timestamp'
            },
            ExpressionAttributeValues: {
                ':ticker': { S: ticker },
                ':start': { N: startTimestamp.toString() }
            }
        });

        const response = await client.send(command);

        const items = response.Items?.map(item => ({
            ticker: item.ticker.S!,
            timestamp: parseFloat(item.timestamp.N!),
            priceUSD: parseFloat(item.priceUSD.N!),
            priceBTC: parseFloat(item.priceBTC.N!),
            btcPriceUSD: parseFloat(item.btcPriceUSD.N!),
        })) || [];

        return JSON.stringify(items);
    } catch (error) {
        console.error('Error fetching prices:', error);
        throw error;
    }
};
