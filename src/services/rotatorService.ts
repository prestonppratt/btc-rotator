// Frontend-only MVP - backend will be added later
export interface RotationSignal {
  signal: 'HOLD' | 'ROTATE';
  sellTicker?: string;
  buyTicker?: string;
  reason?: string;
  expectedAlpha?: number;
}

export async function fetchRotationSignal(): Promise<RotationSignal> {
  // Stub for MVP - return mock signal
  return {
    signal: 'HOLD',
    reason: 'No new signal (Backend coming soon)',
  };
}
