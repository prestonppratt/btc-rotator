// Frontend-only MVP - backend will be added later
export interface RotationSignal {
  shouldRotate: boolean;
  currentPosition: string | null;
  newTopTicker: string;
  newTopScore: number;
  scoreGap: number;
  message: string;
  expectedAlpha: number;
  scores?: Array<{
    ticker: string;
    momentum: number;
    correlation: number;
    score: number;
  }>;
}

export async function fetchRotationSignal(): Promise<RotationSignal> {
  // Stub for MVP - return mock signal
  return {
    shouldRotate: false,
    currentPosition: 'BTC-USD',
    newTopTicker: 'BTC-USD',
    newTopScore: 0.5,
    scoreGap: 0,
    message: 'HOLD – no new signal (Backend coming soon)',
    expectedAlpha: 0,
  };
}
