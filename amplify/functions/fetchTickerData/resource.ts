import { defineFunction } from '@aws-amplify/backend';

export const fetchTickerData = defineFunction({
  name: 'fetchTickerData',
  entry: './handler.py',
  runtime: 3.12,
  timeoutSeconds: 30,
  environment: {
    TICKERS: 'BTC-USD,MSTR,SMLR,ASST,MARA,RIOT,COIN,HUT,CLSK,BITF,WULF,CORZ,IREN,CIFR,BTBT',
  },
});

