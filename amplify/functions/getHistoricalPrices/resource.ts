import { defineFunction } from '@aws-amplify/backend';

export const getHistoricalPrices = defineFunction({
    name: 'getHistoricalPrices',
    entry: './handler.ts',
    resourceGroupName: 'data',
});
