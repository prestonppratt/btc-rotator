import { defineFunction } from '@aws-amplify/backend';

export const backtest = defineFunction({
  name: 'backtest',
  entry: './handler.py',
  runtime: 3.12,
  timeoutSeconds: 300, // 5 minutes for backtesting
});

