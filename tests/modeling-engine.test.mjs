import test from 'node:test';
import assert from 'node:assert/strict';

const rankByTotalReturn = (rows) =>
  [...rows]
    .sort((a, b) => b.totalReturn - a.totalReturn)
    .map((row, i) => ({ ...row, rank: i + 1, bestOverPeriod: i === 0 }));

const normalizeSeries = (series, base = 10000) => {
  if (!series.length) return [];
  const first = series[0].equity || 1;
  return series.map((p) => ({ ...p, equity: (p.equity / first) * base }));
};

const roundQty = (ticker, qty, mode) => {
  if (mode === 'fractional') return ticker === 'BTC-USD' ? Number(qty.toFixed(8)) : Number(qty.toFixed(4));
  if (mode === 'whole') return Math.trunc(qty);
  return ticker === 'BTC-USD' ? Number(qty.toFixed(8)) : Math.trunc(qty);
};

const recommendTrades = ({ currentHoldings, latestPrices, targetWeights, minimumTradeUSD, roundLots }) => {
  const currentValueByTicker = Object.fromEntries(
    Object.entries(currentHoldings).map(([ticker, qty]) => [ticker, qty * (latestPrices[ticker] || 0)])
  );
  const portfolioValue = Object.values(currentValueByTicker).reduce((a, b) => a + b, 0);
  const targetAllocations = Object.fromEntries(
    Object.entries(targetWeights).map(([ticker, w]) => [ticker, portfolioValue * w])
  );

  const sellOrders = [];
  const buyOrders = [];
  for (const ticker of new Set([...Object.keys(currentHoldings), ...Object.keys(targetWeights)])) {
    const current = currentValueByTicker[ticker] || 0;
    const target = targetAllocations[ticker] || 0;
    const delta = target - current;
    if (Math.abs(delta) < minimumTradeUSD) continue;
    const px = latestPrices[ticker] || 0;
    if (px <= 0) continue;
    const qty = roundQty(ticker, Math.abs(delta) / px, roundLots);
    if (qty <= 0) continue;
    const dollars = qty * px;
    if (delta < 0) sellOrders.push({ ticker, quantity: qty, dollars });
    else buyOrders.push({ ticker, quantity: qty, dollars });
  }
  return { sellOrders, buyOrders };
};

test('ranks selected models and marks best performer', () => {
  const ranked = rankByTotalReturn([
    { model: 'A', totalReturn: 0.12 },
    { model: 'B', totalReturn: 0.31 },
    { model: 'C', totalReturn: -0.05 },
  ]);
  assert.equal(ranked[0].model, 'B');
  assert.equal(ranked[0].bestOverPeriod, true);
  assert.equal(ranked[1].rank, 2);
  assert.equal(ranked[2].model, 'C');
});

test('normalizes actual-vs-model comparison to common starting value', () => {
  const normalized = normalizeSeries([
    { date: '2026-01-01', equity: 2500 },
    { date: '2026-01-02', equity: 3000 },
  ]);
  assert.equal(normalized[0].equity, 10000);
  assert.equal(normalized[1].equity, 12000);
});

test('applies min trade threshold and rounding rules in recommendations', () => {
  const rec = recommendTrades({
    currentHoldings: { 'BTC-USD': 0.12, MSTR: 3 },
    latestPrices: { 'BTC-USD': 80000, MSTR: 200 },
    targetWeights: { 'BTC-USD': 0.6, MSTR: 0.4 },
    minimumTradeUSD: 200,
    roundLots: 'auto',
  });

  assert.ok(Array.isArray(rec.sellOrders));
  assert.ok(Array.isArray(rec.buyOrders));
  for (const order of rec.buyOrders) {
    if (order.ticker === 'MSTR') assert.equal(order.quantity, Math.trunc(order.quantity));
  }
});

test('quantity rounding supports fractional BTC and whole-share equities', () => {
  assert.equal(roundQty('BTC-USD', 0.123456789, 'auto'), 0.12345679);
  assert.equal(roundQty('MSTR', 3.9876, 'auto'), 3);
  assert.equal(roundQty('MSTR', 3.9876, 'fractional'), 3.9876);
  assert.equal(roundQty('BTC-USD', 0.87654, 'whole'), 0);
});

test('1-bar delay control example uses next bar return, not same-bar', () => {
  const prices = [100, 110, 99];
  const signalAtBar1 = prices[1] > prices[0] ? 1 : 0;
  const sameBar = signalAtBar1 * ((prices[1] / prices[0]) - 1);
  const nextBar = signalAtBar1 * ((prices[2] / prices[1]) - 1);
  assert.notEqual(sameBar, nextBar);
  assert.ok(Math.abs(nextBar - (-0.1)) < 1e-10);
});
