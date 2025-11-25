import { defineFunction } from '@aws-amplify/backend';

// Scheduled function to update historical prices daily
export const updateHistoricalPrices = defineFunction({
  name: 'updateHistoricalPrices',
  entry: './handler.ts',
  timeoutSeconds: 300, // 5 minutes
});

