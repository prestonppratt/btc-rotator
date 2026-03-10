#!/usr/bin/env node

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const DEFAULT_TICKERS = [
  "BTC-USD",
  "MSTR",
  "ASST",
  "FBTC",
  "MARA",
  "RIOT",
  "COIN",
  "HUT",
  "CLSK",
  "BITF",
  "WULF",
  "CORZ",
  "IREN",
  "CIFR",
  "BTBT",
];

const DAY_MS = 24 * 60 * 60 * 1000;

function parseArgs(argv) {
  const options = {
    region: "us-east-1",
    dailyTargetDays: 1095,
    dailyStepDays: 365,
    hourlyTargetDays: 90,
    hourlyWindows: [7, 14, 30, 60, 90],
    pauseMs: 15000,
    maxInvocations: 12,
    execute: false,
    tableName: process.env.BACKFILL_TABLE_NAME || "",
    functionName: process.env.BACKFILL_FUNCTION_NAME || "",
    tickers: [...DEFAULT_TICKERS],
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--execute") options.execute = true;
    else if (arg === "--region") options.region = argv[++i];
    else if (arg === "--table") options.tableName = argv[++i];
    else if (arg === "--function") options.functionName = argv[++i];
    else if (arg === "--daily-target-days") options.dailyTargetDays = Number(argv[++i]);
    else if (arg === "--daily-step-days") options.dailyStepDays = Number(argv[++i]);
    else if (arg === "--hourly-target-days") options.hourlyTargetDays = Number(argv[++i]);
    else if (arg === "--hourly-windows") {
      options.hourlyWindows = argv[++i]
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0 && n <= 90)
        .sort((a, b) => a - b);
    }
    else if (arg === "--pause-ms") options.pauseMs = Number(argv[++i]);
    else if (arg === "--max-invocations") options.maxInvocations = Number(argv[++i]);
    else if (arg === "--tickers") {
      options.tickers = argv[++i]
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
    } else if (arg === "--help") {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Usage:
  node backfill_missing_history.mjs --table <DDB_TABLE> --function <LAMBDA_NAME> [options]

Options:
  --execute              Actually run Lambda invocations (default is dry-run)
  --region <region>      AWS region (default: us-east-1)
  --daily-target-days <n> Desired daily history depth from now (default: 1095)
  --daily-step-days <n>  Incremental daily window size (default: 365)
  --hourly-target-days <n> Max hourly horizon; keep <=90 (default: 90)
  --hourly-windows <csv> Hourly densify windows <=90 (default: 7,14,30,60,90)
  --pause-ms <n>         Sleep between invocations (default: 15000)
  --max-invocations <n>  Cap Lambda calls per run to stay under limits (default: 12)
  --tickers <csv>        Comma-separated tickers (default: built-in list)

Env fallback:
  BACKFILL_TABLE_NAME
  BACKFILL_FUNCTION_NAME

Example dry run:
  node backfill_missing_history.mjs --table HistoricalPrice-xyz --function fetchHistoricalPrices

Example execute:
  node backfill_missing_history.mjs --table HistoricalPrice-xyz --function fetchHistoricalPrices --execute --daily-target-days 1825 --daily-step-days 365 --hourly-windows 14,30,60,90 --pause-ms 20000 --max-invocations 10
`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildWindows(coverageDays, targetDays, stepDays) {
  if (coverageDays >= targetDays) return [];
  const start = Math.max(stepDays, Math.ceil((coverageDays + 1) / stepDays) * stepDays);
  const windows = [];
  for (let d = start; d < targetDays; d += stepDays) {
    windows.push(d);
  }
  if (windows.length === 0 || windows[windows.length - 1] !== targetDays) {
    windows.push(targetDays);
  }
  return windows;
}

function buildHourlyWindows(hourlyWindows, hourlyTargetDays) {
  const capped = hourlyWindows.filter((d) => d <= hourlyTargetDays);
  return Array.from(new Set(capped)).sort((a, b) => a - b);
}

async function getCoverageDays(docClient, tableName, ticker) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "ticker = :ticker",
      ExpressionAttributeValues: {
        ":ticker": ticker,
      },
      ScanIndexForward: true,
      Limit: 1,
    })
  );

  const earliest = result.Items?.[0]?.timestamp;
  if (!earliest || Number.isNaN(Number(earliest))) return 0;

  const coverageDays = Math.floor((Date.now() - Number(earliest)) / DAY_MS);
  return Math.max(0, coverageDays);
}

async function invokeBackfill(lambdaClient, functionName, ticker, days) {
  const payload = {
    arguments: {
      tickers: [ticker],
      days,
    },
  };

  const response = await lambdaClient.send(
    new InvokeCommand({
      FunctionName: functionName,
      InvocationType: "RequestResponse",
      Payload: Buffer.from(JSON.stringify(payload)),
    })
  );

  return response.StatusCode ?? 0;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.tableName || !options.functionName) {
    printHelp();
    throw new Error("Missing required --table and --function values.");
  }
  if (!Number.isFinite(options.dailyTargetDays) || options.dailyTargetDays <= 0) {
    throw new Error("--daily-target-days must be a positive number.");
  }
  if (!Number.isFinite(options.dailyStepDays) || options.dailyStepDays <= 0) {
    throw new Error("--daily-step-days must be a positive number.");
  }
  if (!Number.isFinite(options.hourlyTargetDays) || options.hourlyTargetDays <= 0 || options.hourlyTargetDays > 90) {
    throw new Error("--hourly-target-days must be in range 1..90.");
  }
  if (!Number.isFinite(options.maxInvocations) || options.maxInvocations <= 0) {
    throw new Error("--max-invocations must be a positive number.");
  }

  const ddbClient = new DynamoDBClient({ region: options.region });
  const docClient = DynamoDBDocumentClient.from(ddbClient);
  const lambdaClient = new LambdaClient({ region: options.region });

  console.log("Backfill config:");
  console.log(JSON.stringify(options, null, 2));
  console.log(options.execute ? "Mode: EXECUTE" : "Mode: DRY-RUN");

  let invocationCount = 0;

  for (const ticker of options.tickers) {
    try {
      const coverageDays = await getCoverageDays(docClient, options.tableName, ticker);
      const dailyWindows = buildWindows(coverageDays, options.dailyTargetDays, options.dailyStepDays);
      const hourlyWindows = buildHourlyWindows(options.hourlyWindows, options.hourlyTargetDays);

      if (dailyWindows.length === 0 && hourlyWindows.length === 0) {
        console.log(`[SKIP] ${ticker}: nothing to request`);
        continue;
      }

      const planParts = [];
      if (dailyWindows.length > 0) {
        planParts.push(`daily=${dailyWindows.join(",")}d`);
      } else {
        planParts.push(`daily=ok(${coverageDays}d covered)`);
      }
      if (hourlyWindows.length > 0) {
        planParts.push(`hourly=${hourlyWindows.join(",")}d`);
      }
      console.log(`[PLAN] ${ticker}: ${planParts.join(" | ")}`);

      if (!options.execute) {
        continue;
      }

      for (const days of dailyWindows) {
        if (invocationCount >= options.maxInvocations) {
          console.log(`[STOP] Reached max invocations (${options.maxInvocations}).`);
          return;
        }
        const status = await invokeBackfill(lambdaClient, options.functionName, ticker, days);
        invocationCount += 1;
        console.log(`[RUN] ${ticker}: daily window ${days}d (lambda status ${status}) [${invocationCount}/${options.maxInvocations}]`);
        await sleep(options.pauseMs);
      }

      for (const days of hourlyWindows) {
        if (invocationCount >= options.maxInvocations) {
          console.log(`[STOP] Reached max invocations (${options.maxInvocations}).`);
          return;
        }
        const status = await invokeBackfill(lambdaClient, options.functionName, ticker, days);
        invocationCount += 1;
        console.log(`[RUN] ${ticker}: hourly densify ${days}d (lambda status ${status}) [${invocationCount}/${options.maxInvocations}]`);
        await sleep(options.pauseMs);
      }
    } catch (error) {
      console.error(`[ERROR] ${ticker}:`, error);
    }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
