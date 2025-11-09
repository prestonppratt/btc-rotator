import { defineFunction } from '@aws-amplify/backend';

export const rotator = defineFunction({
  name: 'rotator',
  entry: './handler.py',
  runtime: 3.12,
  timeoutSeconds: 60, // Increased timeout for data fetching
});

