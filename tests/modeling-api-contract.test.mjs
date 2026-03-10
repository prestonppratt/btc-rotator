import test from 'node:test';
import assert from 'node:assert/strict';

test('comparison API payload contains expected top-level keys', () => {
  const payload = {
    config: {},
    dates: ['2026-01-01'],
    actualSeries: [{ date: '2026-01-01', equity: 10000 }],
    models: [{ model: 'Relative Momentum', series: [], metrics: {} }],
    ranking: [{ model: 'Relative Momentum', rank: 1, bestOverPeriod: true, metrics: {} }],
  };

  assert.ok(payload.config);
  assert.ok(Array.isArray(payload.dates));
  assert.ok(Array.isArray(payload.actualSeries));
  assert.ok(Array.isArray(payload.models));
  assert.ok(Array.isArray(payload.ranking));
});

test('recommendation API payload includes sell/buy and target allocation fields', () => {
  const rec = {
    model: 'Relative Momentum',
    signalDate: '2026-03-09',
    targetAllocations: { 'BTC-USD': 6000, MSTR: 4000 },
    targetWeights: { 'BTC-USD': 0.6, MSTR: 0.4 },
    sellOrders: [],
    buyOrders: [{ ticker: 'BTC-USD', quantity: 0.05, dollars: 4000 }],
    netCashImpact: -4000,
    estimatedTurnover: 0.4,
    notes: ['Uses 1-bar delayed signals'],
    timestamp: '2026-03-09T00:00:00.000Z',
  };

  assert.equal(typeof rec.model, 'string');
  assert.equal(typeof rec.signalDate, 'string');
  assert.equal(typeof rec.targetAllocations, 'object');
  assert.ok(Array.isArray(rec.sellOrders));
  assert.ok(Array.isArray(rec.buyOrders));
  assert.equal(typeof rec.estimatedTurnover, 'number');
});
