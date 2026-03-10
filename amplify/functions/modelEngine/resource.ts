import { defineFunction } from '@aws-amplify/backend';

export const modelEngine = defineFunction({
  name: 'modelEngine',
  entry: './handler.ts',
  timeoutSeconds: 120,
  resourceGroupName: 'data',
});
