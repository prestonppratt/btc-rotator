import { defineFunction } from '@aws-amplify/backend';

export const rotator = defineFunction({
  name: 'rotator',
  entry: './handler.py',
  runtime: 20,
  timeoutSeconds: 300,
});

