import { defineFunction } from '@aws-amplify/backend';

export const postConfirmation = defineFunction({
  name: 'postConfirmation',
  entry: './handler.py',
  runtime: 3.12,
  timeoutSeconds: 30,
});

