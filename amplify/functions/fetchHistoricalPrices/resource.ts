import { defineFunction } from '@aws-amplify/backend';

export const fetchHistoricalPrices = defineFunction({
  name: 'fetchHistoricalPrices',
  entry: './handler.ts',
  timeoutSeconds: 300, // 5 minutes for fetching multiple tickers
  resourceGroupName: 'data', // Assign to data stack to avoid circular dependency
});
