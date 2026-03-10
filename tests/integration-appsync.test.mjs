import test from 'node:test';
import assert from 'node:assert/strict';

const APPSYNC_URL = process.env.APPSYNC_URL;
const APPSYNC_JWT = process.env.APPSYNC_JWT;

const hasEnv = Boolean(APPSYNC_URL && APPSYNC_JWT);

const gql = async (query, variables = {}) => {
  const res = await fetch(APPSYNC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: APPSYNC_JWT,
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors) {
    throw new Error(body.errors.map((e) => e.message).join('; '));
  }
  return body.data;
};

test('listModels deployed integration', { skip: !hasEnv }, async () => {
  const data = await gql(`
    query ListModels {
      listModels
    }
  `);
  assert.ok(Array.isArray(data.listModels));
  assert.ok(data.listModels.length >= 1);
});

test('runModelComparison deployed integration', { skip: !hasEnv }, async () => {
  const data = await gql(
    `
    query RunComparison($config: AWSJSON) {
      runModelComparison(config: $config)
    }
  `,
    {
      config: JSON.stringify({
        models: ['Relative Momentum'],
        tickers: ['BTC-USD', 'MSTR', 'MARA', 'ASST'],
        startDate: '2025-01-01',
        endDate: '2026-03-01',
        rebalanceFrequency: 'weekly',
        topN: 1,
        cashAllowed: true,
      }),
    }
  );
  const parsed = JSON.parse(data.runModelComparison);
  assert.ok(Array.isArray(parsed.models));
  assert.ok(Array.isArray(parsed.ranking));
});

test('getTradeRecommendations deployed integration', { skip: !hasEnv }, async () => {
  const data = await gql(
    `
    query TradeRec($model: String, $config: AWSJSON, $currentHoldings: AWSJSON) {
      getTradeRecommendations(model: $model, config: $config, currentHoldings: $currentHoldings)
    }
  `,
    {
      model: 'Relative Momentum',
      config: JSON.stringify({
        tickers: ['BTC-USD', 'MSTR', 'MARA', 'ASST'],
        startDate: '2025-01-01',
        endDate: '2026-03-01',
      }),
      currentHoldings: JSON.stringify({ 'BTC-USD': 0.1, MSTR: 2, MARA: 5, ASST: 10 }),
    }
  );
  const parsed = JSON.parse(data.getTradeRecommendations);
  assert.equal(typeof parsed.model, 'string');
  assert.ok(Array.isArray(parsed.buyOrders));
  assert.ok(Array.isArray(parsed.sellOrders));
});
