import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMergedComparisonChartData, buildRankingRows } from '../src/utils/modelComparison';
import type { ComparisonResponse } from '../src/services/modelingService';

const sample: ComparisonResponse = {
  config: {
    models: ['Relative Momentum', 'Dual Momentum'],
    tickers: ['BTC-USD', 'MSTR'],
    startDate: '2026-01-01',
    endDate: '2026-01-03',
    rebalanceFrequency: 'weekly',
    topN: 1,
    cashAllowed: true,
    lookback: 30,
    transactionCostBps: 5,
    slippageBps: 5,
    execution: 'next_close',
    minimumTradeUSD: 50,
    executionBuffer: 0.005,
    roundLots: 'auto',
  },
  dates: ['2026-01-01', '2026-01-02', '2026-01-03'],
  actualSeries: [
    { date: '2026-01-01', equity: 10000 },
    { date: '2026-01-02', equity: 10100 },
    { date: '2026-01-03', equity: 10300 },
  ],
  models: [
    {
      model: 'Relative Momentum',
      latestSignalDate: '2026-01-03',
      latestTargetWeights: { 'BTC-USD': 1 },
      metrics: {
        totalReturn: 0.08,
        cagr: 0.1,
        annualizedVolatility: 0.2,
        sharpe: 1,
        sortino: 1.2,
        maxDrawdown: -0.12,
        calmar: 0.8,
        tradeCount: 10,
        turnover: 0.4,
        winRate: 0.55,
      },
      series: [
        { date: '2026-01-01', equity: 10000 },
        { date: '2026-01-02', equity: 10200 },
        { date: '2026-01-03', equity: 10800 },
      ],
    },
    {
      model: 'Dual Momentum',
      latestSignalDate: '2026-01-03',
      latestTargetWeights: { MSTR: 1 },
      metrics: {
        totalReturn: 0.02,
        cagr: 0.03,
        annualizedVolatility: 0.22,
        sharpe: 0.5,
        sortino: 0.7,
        maxDrawdown: -0.2,
        calmar: 0.15,
        tradeCount: 12,
        turnover: 0.6,
        winRate: 0.5,
      },
      series: [
        { date: '2026-01-01', equity: 10000 },
        { date: '2026-01-02', equity: 9950 },
        { date: '2026-01-03', equity: 10200 },
      ],
    },
  ],
  ranking: [
    {
      model: 'Relative Momentum',
      rank: 1,
      bestOverPeriod: true,
      metrics: {
        totalReturn: 0.08,
        cagr: 0.1,
        annualizedVolatility: 0.2,
        sharpe: 1,
        sortino: 1.2,
        maxDrawdown: -0.12,
        calmar: 0.8,
        tradeCount: 10,
        turnover: 0.4,
        winRate: 0.55,
      },
    },
    {
      model: 'Dual Momentum',
      rank: 2,
      bestOverPeriod: false,
      metrics: {
        totalReturn: 0.02,
        cagr: 0.03,
        annualizedVolatility: 0.22,
        sharpe: 0.5,
        sortino: 0.7,
        maxDrawdown: -0.2,
        calmar: 0.15,
        tradeCount: 12,
        turnover: 0.6,
        winRate: 0.5,
      },
    },
  ],
};

test('buildMergedComparisonChartData merges actual and model series by date', () => {
  const rows = buildMergedComparisonChartData(sample);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].date, '2026-01-01');
  assert.equal(rows[0]['Actual Portfolio'], 10000);
  assert.equal(rows[0]['Relative Momentum'], 10000);
  assert.equal(rows[0]['Dual Momentum'], 10000);
  assert.equal(rows[2]['Actual Portfolio'], 10300);
  assert.equal(rows[2]['Relative Momentum'], 10800);
});

test('buildRankingRows computes performance delta vs actual for results table', () => {
  const rows = buildRankingRows(sample);
  assert.equal(rows.length, 2);

  const actualReturn = (10300 / 10000) - 1;
  assert.equal(rows[0].model, 'Relative Momentum');
  assert.ok(Math.abs(rows[0].deltaVsActual - (0.08 - actualReturn)) < 1e-12);
  assert.equal(rows[0].bestOverPeriod, true);

  assert.equal(rows[1].model, 'Dual Momentum');
  assert.ok(rows[1].deltaVsActual < 0);
});
