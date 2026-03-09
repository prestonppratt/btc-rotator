import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const client = new LambdaClient({ region: "us-east-1" });

// Function name from sandbox
const FUNCTION_NAME = "amplify-btcrotator-presto-fetchHistoricalPriceslam-1cur9J2KBPl9";

async function triggerFetch() {
    try {
        const payload = {
            arguments: {
                tickers: ["SMLR"], // Fetch SMLR
                days: 90, // 90 days to match BTC and MSTR
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
        console.log("\nFetching 90 days of SMLR data from CoinGecko (semler-scientific)...");
        console.log("This will take a few moments. Check CloudWatch logs for progress.");

    } catch (error) {
        console.error("Error invoking Lambda:", error);
    }
}

triggerFetch();
