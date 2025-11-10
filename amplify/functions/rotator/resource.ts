import { defineFunction } from '@aws-amplify/backend';

// Note: defineFunction only supports Node.js/TypeScript
// For Python, we'll use a custom CDK resource in backend.ts
export const rotator = defineFunction({
  name: 'rotator',
  entry: './handler.py',
  runtime: 20,
  timeoutSeconds: 300,
});

