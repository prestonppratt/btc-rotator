import type { ComparisonResponse } from '../services/modelingService';

export const buildMergedComparisonChartData = (comparison: ComparisonResponse | null) => {
  if (!comparison) return [];
  const map = new Map<string, Record<string, any>>();

  comparison.actualSeries.forEach((p) => {
    map.set(p.date, { date: p.date, 'Actual Portfolio': p.equity });
  });

  comparison.models.forEach((model) => {
    model.series.forEach((p) => {
      const row = map.get(p.date) || { date: p.date };
      row[model.model] = p.equity;
      map.set(p.date, row);
    });
  });

  return Array.from(map.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
};

export const computeActualTotalReturn = (comparison: ComparisonResponse | null): number => {
  if (!comparison?.actualSeries || comparison.actualSeries.length < 2) return 0;
  const first = comparison.actualSeries[0].equity || 1;
  const last = comparison.actualSeries[comparison.actualSeries.length - 1].equity || first;
  return (last / first) - 1;
};

export interface RankingRowView {
  model: string;
  rank: number;
  bestOverPeriod: boolean;
  totalReturn: number;
  cagr: number;
  sharpe: number;
  maxDrawdown: number;
  turnover: number;
  deltaVsActual: number;
}

export const buildRankingRows = (comparison: ComparisonResponse | null): RankingRowView[] => {
  if (!comparison) return [];
  const actualTotalReturn = computeActualTotalReturn(comparison);
  return comparison.ranking.map((row) => ({
    model: row.model,
    rank: row.rank,
    bestOverPeriod: row.bestOverPeriod,
    totalReturn: row.metrics.totalReturn,
    cagr: row.metrics.cagr,
    sharpe: row.metrics.sharpe,
    maxDrawdown: row.metrics.maxDrawdown,
    turnover: row.metrics.turnover,
    deltaVsActual: row.metrics.totalReturn - actualTotalReturn,
  }));
};
