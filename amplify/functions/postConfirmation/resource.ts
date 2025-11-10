import { defineFunction } from '@aws-amplify/backend';

// Note: defineFunction only supports Node.js/TypeScript
// For Python, we'll use a custom CDK resource in backend.ts
export const postConfirmation = defineFunction({
  name: 'postConfirmation',
  entry: './handler.py',
  runtime: 20,
});

