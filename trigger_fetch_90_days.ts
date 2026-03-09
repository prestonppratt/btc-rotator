import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const client = new LambdaClient({ region: "us-east-1" });

// Function name from previous context (logs)
const FUNCTION_NAME = "amplify-btcrotator-presto-fetchHistoricalPriceslam-1cur9J2KBPl9";

async function triggerFetch() {
    try {
        const payload = {
            arguments: {
                tickers: ["BTC-USD"], // Only fetch BTC-USD for now
                days: 90,
            },
        };

        const command = new InvokeCommand({
            FunctionName: FUNCTION_NAME,
            InvocationType: "Event", // Async invocation
            Payload: Buffer.from(JSON.stringify(payload)),
        });

        console.log(`Invoking Lambda: ${FUNCTION_NAME}`);
        console.log(`Payload:`, JSON.stringify(payload, null, 2));

        const response = await client.send(command);
        console.log("Lambda invoked successfully:", response.StatusCode);

    } catch (error) {
        console.error("Error invoking Lambda:", error);
    }
}

triggerFetch();
