// Frontend-only MVP - backend will be added later
export interface BacktestDataPoint {
  date: string;
  rotatorValue: number;
  btcValue: number;
}

export interface BacktestResponse {
  cached: boolean;
  cacheTime?: string;
  results: BacktestDataPoint[];
  summary?: {
    startDate: string;
    endDate: string;
    initialCapital: number;
    finalRotatorValue: number;
    finalBtcValue: number;
    totalReturn: number;
    btcReturn: number;
  };
}

export async function fetchBacktestData(): Promise<BacktestResponse> {
  // Stub for MVP - return mock data
  const mockData: BacktestDataPoint[] = [];
  const startDate = new Date('2024-11-09');
  const today = new Date();
  let rotatorValue = 10000;
  let btcValue = 10000;

  let dayIndex = 0;
  for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1), dayIndex++) {
    const dateStr = d.toISOString().split('T')[0];
    const rotatorDelta = 18 + Math.sin(dayIndex / 11) * 42 + Math.cos(dayIndex / 17) * 9;
    const btcDelta = 12 + Math.sin(dayIndex / 10) * 38 + Math.cos(dayIndex / 14) * 12;
    rotatorValue += rotatorDelta;
    btcValue += btcDelta;
    mockData.push({
      date: dateStr,
      rotatorValue: Math.max(5000, rotatorValue),
      btcValue: Math.max(5000, btcValue),
    });
  }
  
  return {
    cached: false,
    results: mockData,
    summary: {
      startDate: '2024-11-09',
      endDate: today.toISOString().split('T')[0],
      initialCapital: 10000,
      finalRotatorValue: rotatorValue,
      finalBtcValue: btcValue,
      totalReturn: ((rotatorValue - 10000) / 10000) * 100,
      btcReturn: ((btcValue - 10000) / 10000) * 100,
    },
  };
}
