// Supported tickers - hardcoded as requested
export const SUPPORTED_TICKERS = [
  'BTC-USD',
  'MSTR',
  'SMLR',
  'ASST',
  'FBTC',
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

export const TICKER_NAMES: Record<string, string> = {
  'BTC-USD': 'Bitcoin',
  'MSTR': 'MicroStrategy',
  'SMLR': 'Semler Scientific',
  'ASST': 'Asset Entities',
  'FBTC': 'Fidelity Wise Origin Bitcoin Fund',
  'MARA': 'Marathon Digital',
  'RIOT': 'Riot Platforms',
  'COIN': 'Coinbase',
  'HUT': 'Hut 8',
  'CLSK': 'CleanSpark',
  'BITF': 'Bitfarms',
  'WULF': 'TeraWulf',
  'CORZ': 'Core Scientific',
  'IREN': 'Iris Energy',
  'CIFR': 'Cipher Mining',
  'BTBT': 'Bit Digital',
};

