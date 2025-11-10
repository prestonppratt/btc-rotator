// Frontend-only MVP - backend will be added later
export interface BacktestDataPoint {
  date: string;
  rotatorValue: number;
  btcValue: number;
}

export async function fetchBacktestData(): Promise<BacktestDataPoint[]> {
  // Stub for MVP - return mock data
  return [
    { date: '2024-11-09', rotatorValue: 10000, btcValue: 10000 },
    { date: '2024-11-10', rotatorValue: 10100, btcValue: 10050 },
    { date: '2024-11-11', rotatorValue: 10200, btcValue: 10100 },
  ];
}
