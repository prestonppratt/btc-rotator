// Supported tickers - hardcoded as requested
export const SUPPORTED_TICKERS = [
  'BTC-USD',
  'MSTR',
  'SMLR',
  'ASST',
  'MARA',
  'RIOT',
  'COIN',
  'HUT',
  'CLSK',
  'BITF',
  'WULF',
  'CORZ',
  'IREN',
  'CIFR',
  'BTBT',
] as const;

export type TickerSymbol = typeof SUPPORTED_TICKERS[number];

export const TICKER_NAMES: Record<TickerSymbol, string> = {
  'BTC-USD': 'Bitcoin',
  'MSTR': 'MicroStrategy',
  'SMLR': 'Smiler',
  'ASST': 'Asset Entities',
  'MARA': 'Marathon Digital',
  'RIOT': 'Riot Platforms',
  'COIN': 'Coinbase',
  'HUT': 'Hut 8 Mining',
  'CLSK': 'CleanSpark',
  'BITF': 'Bitfarms',
  'WULF': 'TeraWulf',
  'CORZ': 'Core Scientific',
  'IREN': 'Iris Energy',
  'CIFR': 'Cipher Mining',
  'BTBT': 'Bit Digital',
};

