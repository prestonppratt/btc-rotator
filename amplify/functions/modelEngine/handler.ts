import type { Handler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

type ModelName =
  | 'Relative Momentum'
  | 'Time-Series Momentum'
  | 'Dual Momentum'
  | 'Volatility-Adjusted Momentum'
  | 'Mean Reversion'
  | 'Ensemble';

interface PriceRow {
  ticker: string;
  timestamp: number;
  priceUSD: number;
}

interface BacktestConfig {
  models: ModelName[];
  tickers: string[];
  startDate: string;
  endDate: string;
  rebalanceFrequency: 'daily' | 'weekly' | 'monthly';
  topN: 1 | 2;
  cashAllowed: boolean;
  lookback: number;
  transactionCostBps: number;
  slippageBps: number;
  execution: 'next_open' | 'next_close';
  minimumTradeUSD: number;
  executionBuffer: number;
  roundLots: 'auto' | 'fractional' | 'whole';
}

interface TradeRecInput {
  model: ModelName;
  config: BacktestConfig;
  currentHoldings: Record<string, number>;
  latestPrices: Record<string, number>;
}

interface EquityPoint {
  date: string;
  equity: number;
}

interface Metrics {
  totalReturn: number;
  cagr: number;
  annualizedVolatility: number;
  sharpe: number;
  sortino: number;
  maxDrawdown: number;
  calmar: number;
  tradeCount: number;
  turnover: number;
  winRate: number;
}

const MODEL_NAMES: ModelName[] = [
  'Relative Momentum',
  'Time-Series Momentum',
  'Dual Momentum',
  'Volatility-Adjusted Momentum',
  'Mean Reversion',
  'Ensemble',
];

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const toIsoDay = (ts: number): string => new Date(ts).toISOString().slice(0, 10);
const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const stdev = (xs: number[]): number => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((acc, x) => acc + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
};

const clampConfig = (raw: any): BacktestConfig => {
  const models = (Array.isArray(raw?.models) ? raw.models : MODEL_NAMES).filter((m: string) =>
    MODEL_NAMES.includes(m as ModelName)
  ) as ModelName[];

  return {
    models: models.length > 0 ? models : MODEL_NAMES,
    tickers: (Array.isArray(raw?.tickers) && raw.tickers.length > 0 ? raw.tickers : ['BTC-USD', 'MSTR', 'MARA', 'ASST'])
      .map((t: string) => String(t).toUpperCase()),
    startDate: String(raw?.startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
    endDate: String(raw?.endDate || new Date().toISOString().slice(0, 10)),
    rebalanceFrequency: (['daily', 'weekly', 'monthly'].includes(raw?.rebalanceFrequency) ? raw.rebalanceFrequency : 'weekly') as BacktestConfig['rebalanceFrequency'],
    topN: raw?.topN === 2 ? 2 : 1,
    cashAllowed: Boolean(raw?.cashAllowed),
    lookback: Math.max(5, Math.min(252, Number(raw?.lookback ?? 30))),
    transactionCostBps: Math.max(0, Number(raw?.transactionCostBps ?? 5)),
    slippageBps: Math.max(0, Number(raw?.slippageBps ?? 5)),
    execution: raw?.execution === 'next_open' ? 'next_open' : 'next_close',
    minimumTradeUSD: Math.max(0, Number(raw?.minimumTradeUSD ?? 50)),
    executionBuffer: Math.max(0, Math.min(0.2, Number(raw?.executionBuffer ?? 0.005))),
    roundLots: (['auto', 'fractional', 'whole'].includes(raw?.roundLots) ? raw.roundLots : 'auto') as BacktestConfig['roundLots'],
  };
};

const queryTickerPrices = async (tableName: string, ticker: string, startTs: number, endTs: number): Promise<PriceRow[]> => {
  const rows: PriceRow[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const out = await ddb.send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'ticker = :t AND #ts BETWEEN :start AND :end',
      ExpressionAttributeNames: { '#ts': 'timestamp' },
      ExpressionAttributeValues: {
        ':t': ticker,
        ':start': startTs,
        ':end': endTs,
      },
      ScanIndexForward: true,
      ExclusiveStartKey,
      Limit: 1000,
    }));
    for (const item of out.Items || []) {
      rows.push({
        ticker: String(item.ticker),
        timestamp: Number(item.timestamp),
        priceUSD: Number(item.priceUSD),
      });
    }
    ExclusiveStartKey = out.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return rows;
};

const alignSeries = (rowsByTicker: Record<string, PriceRow[]>) => {
  const dayPriceByTicker: Record<string, Map<string, number>> = {};
  const daySets: Array<Set<string>> = [];

  for (const [ticker, rows] of Object.entries(rowsByTicker)) {
    const map = new Map<string, number>();
    rows.forEach((r) => map.set(toIsoDay(r.timestamp), r.priceUSD));
    dayPriceByTicker[ticker] = map;
    daySets.push(new Set(map.keys()));
  }

  if (daySets.length === 0) return { dates: [] as string[], prices: {} as Record<string, number[]> };

  const intersection = [...daySets[0]].filter((d) => daySets.every((s) => s.has(d))).sort();
  const prices: Record<string, number[]> = {};
  for (const ticker of Object.keys(rowsByTicker)) {
    prices[ticker] = intersection.map((d) => dayPriceByTicker[ticker].get(d) || 0);
  }
  return { dates: intersection, prices };
};

const isRebalanceDay = (dates: string[], i: number, freq: BacktestConfig['rebalanceFrequency']) => {
  if (i === 0) return true;
  if (freq === 'daily') return true;
  const curr = new Date(dates[i] + 'T00:00:00Z');
  const prev = new Date(dates[i - 1] + 'T00:00:00Z');
  if (freq === 'weekly') {
    const weekKey = (d: Date) => `${d.getUTCFullYear()}-${Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000))}`;
    return weekKey(curr) !== weekKey(prev);
  }
  return curr.getUTCMonth() !== prev.getUTCMonth() || curr.getUTCFullYear() !== prev.getUTCFullYear();
};

const scoreForModel = (
  model: ModelName,
  tickers: string[],
  prices: Record<string, number[]>,
  i: number,
  lookback: number,
  cashAllowed: boolean
) => {
  const score: Record<string, number> = {};
  const moms: Record<string, number> = {};
  const tsm: Record<string, number> = {};

  tickers.forEach((t) => {
    const pNow = prices[t][i];
    const pPrev = prices[t][i - lookback];
    const momentum = pPrev > 0 ? (pNow / pPrev) - 1 : 0;
    moms[t] = momentum;

    const dailyRets: number[] = [];
    for (let k = i - lookback + 1; k <= i; k++) {
      if (k <= 0) continue;
      const ret = prices[t][k - 1] > 0 ? (prices[t][k] / prices[t][k - 1]) - 1 : 0;
      dailyRets.push(ret);
    }
    const vol = stdev(dailyRets) || 1e-6;
    tsm[t] = momentum > 0 ? 1 : -1;

    switch (model) {
      case 'Relative Momentum':
        score[t] = momentum;
        break;
      case 'Time-Series Momentum':
        score[t] = tsm[t];
        break;
      case 'Dual Momentum':
        score[t] = cashAllowed && momentum <= 0 ? -999 : momentum;
        break;
      case 'Volatility-Adjusted Momentum':
        score[t] = momentum / vol;
        break;
      case 'Mean Reversion':
        score[t] = -momentum;
        break;
      case 'Ensemble':
        score[t] = 0;
        break;
    }
  });

  if (model === 'Ensemble') {
    const subModels: ModelName[] = [
      'Relative Momentum',
      'Time-Series Momentum',
      'Dual Momentum',
      'Volatility-Adjusted Momentum',
      'Mean Reversion',
    ];
    const agg: Record<string, number> = {};
    tickers.forEach((t) => (agg[t] = 0));
    subModels.forEach((sub) => {
      const s = scoreForModel(sub, tickers, prices, i, lookback, cashAllowed);
      tickers.forEach((t) => {
        agg[t] += s[t] || 0;
      });
    });
    return agg;
  }

  return score;
};

const selectWeights = (
  score: Record<string, number>,
  topN: 1 | 2,
  cashAllowed: boolean
) => {
  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
  const selected = ranked.slice(0, topN).filter(([, s]) => !cashAllowed || s > 0);
  const weights: Record<string, number> = {};
  if (selected.length === 0) return weights;
  const w = 1 / selected.length;
  selected.forEach(([ticker]) => { weights[ticker] = w; });
  return weights;
};

const computeMetrics = (series: EquityPoint[], tradeCount: number, turnover: number): Metrics => {
  if (series.length < 2) {
    return {
      totalReturn: 0, cagr: 0, annualizedVolatility: 0, sharpe: 0, sortino: 0,
      maxDrawdown: 0, calmar: 0, tradeCount: 0, turnover: 0, winRate: 0,
    };
  }

  const rets: number[] = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1].equity;
    const curr = series[i].equity;
    rets.push(prev > 0 ? (curr / prev) - 1 : 0);
  }

  const totalReturn = (series[series.length - 1].equity / series[0].equity) - 1;
  const years = Math.max(1 / 252, rets.length / 252);
  const cagr = Math.pow(1 + totalReturn, 1 / years) - 1;
  const vol = stdev(rets) * Math.sqrt(252);
  const downside = stdev(rets.filter((r) => r < 0)) * Math.sqrt(252);
  const sharpe = vol > 0 ? (mean(rets) * 252) / vol : 0;
  const sortino = downside > 0 ? (mean(rets) * 252) / downside : 0;

  let peak = series[0].equity;
  let maxDd = 0;
  for (const p of series) {
    peak = Math.max(peak, p.equity);
    const dd = peak > 0 ? (p.equity / peak) - 1 : 0;
    maxDd = Math.min(maxDd, dd);
  }
  const calmar = Math.abs(maxDd) > 0 ? cagr / Math.abs(maxDd) : 0;
  const winRate = rets.length > 0 ? rets.filter((r) => r > 0).length / rets.length : 0;

  return {
    totalReturn,
    cagr,
    annualizedVolatility: vol,
    sharpe,
    sortino,
    maxDrawdown: maxDd,
    calmar,
    tradeCount,
    turnover,
    winRate,
  };
};

const runBacktestForModel = (
  model: ModelName,
  dates: string[],
  tickers: string[],
  prices: Record<string, number[]>,
  cfg: BacktestConfig
) => {
  const lookback = cfg.lookback;
  const costRate = (cfg.transactionCostBps + cfg.slippageBps) / 10000;
  const returnsByTicker: Record<string, number[]> = {};
  tickers.forEach((t) => {
    returnsByTicker[t] = [0];
    for (let i = 1; i < dates.length; i++) {
      const prev = prices[t][i - 1];
      const curr = prices[t][i];
      returnsByTicker[t].push(prev > 0 ? (curr / prev) - 1 : 0);
    }
  });

  const weightsHistory: Array<Record<string, number>> = [];
  let prevWeights: Record<string, number> = {};
  let equity = 1;
  let tradeCount = 0;
  let turnover = 0;
  const series: EquityPoint[] = [{ date: dates[0], equity }];
  let latestSignalDate = dates[0];
  let latestTargetWeights: Record<string, number> = {};

  for (let i = 1; i < dates.length; i++) {
    let targetWeights = prevWeights;
    if (i >= lookback && isRebalanceDay(dates, i, cfg.rebalanceFrequency)) {
      const score = scoreForModel(model, tickers, prices, i - 1, lookback, cfg.cashAllowed);
      targetWeights = selectWeights(score, cfg.topN, cfg.cashAllowed);
      latestSignalDate = dates[i - 1];
      latestTargetWeights = targetWeights;

      const changed = new Set([...Object.keys(prevWeights), ...Object.keys(targetWeights)]);
      const stepTurnover = [...changed].reduce((acc, ticker) =>
        acc + Math.abs((targetWeights[ticker] || 0) - (prevWeights[ticker] || 0)), 0
      );
      if (stepTurnover > 1e-9) tradeCount += 1;
      turnover += stepTurnover;
      equity *= Math.max(0, 1 - (stepTurnover * costRate));
    }

    const portRet = Object.entries(targetWeights).reduce((acc, [ticker, w]) =>
      acc + w * (returnsByTicker[ticker]?.[i] || 0), 0
    );
    equity *= (1 + portRet);
    prevWeights = { ...targetWeights };
    weightsHistory.push(prevWeights);
    series.push({ date: dates[i], equity });
  }

  const metrics = computeMetrics(series, tradeCount, turnover);
  return { model, series, metrics, latestSignalDate, latestTargetWeights };
};

const buildActualSeries = (
  dates: string[],
  prices: Record<string, number[]>,
  tickers: string[],
  tradeHistory: any[]
) => {
  if (!Array.isArray(tradeHistory) || tradeHistory.length === 0) return [] as EquityPoint[];

  const tx = tradeHistory
    .map((t: any) => ({
      ticker: String(t.ticker || ''),
      type: t.type === 'SELL' ? 'SELL' : 'BUY',
      quantity: Number(t.quantity || 0),
      priceUSD: Number(t.priceUSD || 0),
      date: toIsoDay(Number(t.timestamp || 0)),
    }))
    .filter((t: any) => t.ticker && t.quantity > 0 && t.priceUSD > 0)
    .sort((a: any, b: any) => a.date.localeCompare(b.date));

  const qty = new Map<string, number>();
  let txIdx = 0;
  const series: EquityPoint[] = [];

  for (let i = 0; i < dates.length; i++) {
    while (txIdx < tx.length && tx[txIdx].date <= dates[i]) {
      const sign = tx[txIdx].type === 'BUY' ? 1 : -1;
      qty.set(tx[txIdx].ticker, (qty.get(tx[txIdx].ticker) || 0) + sign * tx[txIdx].quantity);
      txIdx += 1;
    }
    let value = 0;
    for (const t of tickers) {
      const q = qty.get(t) || 0;
      value += q * (prices[t][i] || 0);
    }
    series.push({ date: dates[i], equity: value });
  }
  return series;
};

const normalizeSeries = (series: EquityPoint[], base = 10000) => {
  if (series.length === 0) return series;
  const first = series[0].equity || 1;
  return series.map((p) => ({ ...p, equity: (p.equity / first) * base }));
};

const getLatestWeights = (
  model: ModelName,
  dates: string[],
  tickers: string[],
  prices: Record<string, number[]>,
  cfg: BacktestConfig
) => {
  const i = dates.length - 1;
  if (i <= cfg.lookback) return {} as Record<string, number>;
  const score = scoreForModel(model, tickers, prices, i - 1, cfg.lookback, cfg.cashAllowed);
  return selectWeights(score, cfg.topN, cfg.cashAllowed);
};

const roundQty = (ticker: string, qty: number, roundLots: BacktestConfig['roundLots']) => {
  const isBtc = ticker === 'BTC-USD';
  if (roundLots === 'fractional') return isBtc ? Number(qty.toFixed(8)) : Number(qty.toFixed(4));
  if (roundLots === 'whole') return Math.trunc(qty);
  return isBtc ? Number(qty.toFixed(8)) : Math.trunc(qty);
};

const buildTradeRecommendations = (input: TradeRecInput) => {
  const { latestPrices, currentHoldings, targetWeights, config } = input as TradeRecInput & { targetWeights: Record<string, number> };
  const currentValueByTicker: Record<string, number> = {};
  let portfolioValue = 0;
  for (const [ticker, qty] of Object.entries(currentHoldings)) {
    const px = latestPrices[ticker] || 0;
    const val = qty * px;
    currentValueByTicker[ticker] = val;
    portfolioValue += val;
  }

  const safePortfolioValue = portfolioValue > 0 ? portfolioValue : 0;
  const targetAllocations = Object.fromEntries(
    Object.entries(targetWeights).map(([ticker, w]) => [ticker, safePortfolioValue * w])
  );

  const sellOrders: Array<{ ticker: string; quantity: number; dollars: number }> = [];
  const buyOrders: Array<{ ticker: string; quantity: number; dollars: number }> = [];
  let turnover = 0;

  const allTickers = new Set([...Object.keys(currentHoldings), ...Object.keys(targetWeights)]);
  allTickers.forEach((ticker) => {
    const current = currentValueByTicker[ticker] || 0;
    const target = targetAllocations[ticker] || 0;
    const delta = target - current;
    const threshold = config.minimumTradeUSD;
    if (Math.abs(delta) < threshold) return;
    const px = latestPrices[ticker] || 0;
    if (px <= 0) return;

    const rawQty = Math.abs(delta) / px;
    const qty = roundQty(ticker, rawQty * (1 - config.executionBuffer), config.roundLots);
    if (qty <= 0) return;
    const dollars = qty * px;
    turnover += Math.abs(delta);
    if (delta < 0) sellOrders.push({ ticker, quantity: qty, dollars });
    else buyOrders.push({ ticker, quantity: qty, dollars });
  });

  return {
    targetAllocations,
    targetWeights,
    sellOrders,
    buyOrders,
    netCashImpact: sellOrders.reduce((a, s) => a + s.dollars, 0) - buyOrders.reduce((a, b) => a + b.dollars, 0),
    estimatedTurnover: safePortfolioValue > 0 ? turnover / safePortfolioValue : 0,
    notes: [
      'Uses 1-bar delayed signals to avoid lookahead bias.',
      `Execution assumption: ${config.execution}.`,
      `Costs: ${config.transactionCostBps}bps + slippage ${config.slippageBps}bps.`,
      `Rounding mode: ${config.roundLots}.`,
    ],
  };
};

export const handler: Handler = async (event: any) => {
  const fieldName = event?.info?.fieldName;
  const args = event?.arguments || {};
  const tableName = process.env.AMPLIFY_DATA_TABLE_NAME_HISTORICALPRICE || process.env.AMPLIFY_DATA_TABLE_NAME;
  const userTableName = process.env.AMPLIFY_DATA_TABLE_NAME_USER || process.env.AMPLIFY_DATA_TABLE_NAME;

  if (!tableName) throw new Error('Historical price table not configured');

  if (fieldName === 'listModels') {
    return MODEL_NAMES;
  }

  const cfg = clampConfig(args.config || args);
  const startTs = new Date(`${cfg.startDate}T00:00:00Z`).getTime();
  const endTs = new Date(`${cfg.endDate}T23:59:59Z`).getTime();

  const rowsByTicker: Record<string, PriceRow[]> = {};
  for (const ticker of cfg.tickers) {
    rowsByTicker[ticker] = await queryTickerPrices(tableName, ticker, startTs, endTs);
  }

  const { dates, prices } = alignSeries(rowsByTicker);
  if (dates.length < cfg.lookback + 5) {
    return JSON.stringify({ error: 'Insufficient aligned data for selected window', dates: dates.length });
  }

  if (fieldName === 'runModelComparison') {
    const result = cfg.models.map((m) => runBacktestForModel(m, dates, cfg.tickers, prices, cfg));
    const ranked = [...result]
      .map((r) => ({ model: r.model, metrics: r.metrics }))
      .sort((a, b) => b.metrics.totalReturn - a.metrics.totalReturn)
      .map((r, i) => ({ ...r, rank: i + 1, bestOverPeriod: i === 0 }));

    let actualSeries: EquityPoint[] = [];
    try {
      const userId = event?.identity?.sub;
      if (userId && userTableName) {
        const user = await ddb.send(new GetCommand({ TableName: userTableName, Key: { id: userId } }));
        const raw = user.Item?.tradeHistory;
        const tradeHistory = typeof raw === 'string' ? JSON.parse(raw) : raw;
        actualSeries = normalizeSeries(buildActualSeries(dates, prices, cfg.tickers, tradeHistory || []));
      }
    } catch {
      actualSeries = [];
    }

    return JSON.stringify({
      config: cfg,
      dates,
      actualSeries,
      models: result.map((r) => ({
        model: r.model,
        latestSignalDate: r.latestSignalDate,
        latestTargetWeights: r.latestTargetWeights,
        metrics: r.metrics,
        series: normalizeSeries(r.series),
      })),
      ranking: ranked,
    });
  }

  if (fieldName === 'getTradeRecommendations') {
    const model = (args.model || cfg.models[0] || MODEL_NAMES[0]) as ModelName;
    const targetWeights = getLatestWeights(model, dates, cfg.tickers, prices, cfg);
    const latestPrices: Record<string, number> = {};
    cfg.tickers.forEach((t) => { latestPrices[t] = prices[t][prices[t].length - 1] || 0; });

    let currentHoldings: Record<string, number> = args.currentHoldings || {};
    if (!currentHoldings || Object.keys(currentHoldings).length === 0) {
      try {
        const userId = event?.identity?.sub;
        if (userId && userTableName) {
          const user = await ddb.send(new GetCommand({ TableName: userTableName, Key: { id: userId } }));
          const rawPortfolio = user.Item?.portfolio;
          const portfolio = typeof rawPortfolio === 'string' ? JSON.parse(rawPortfolio) : rawPortfolio;
          if (Array.isArray(portfolio)) {
            currentHoldings = Object.fromEntries(portfolio.map((p: any) => [String(p.ticker), Number(p.shares || 0)]));
          }
        }
      } catch {
        currentHoldings = {};
      }
    }

    const rec = buildTradeRecommendations({
      model,
      config: cfg,
      currentHoldings,
      latestPrices,
      targetWeights,
    } as any);

    return JSON.stringify({
      model,
      signalDate: dates[dates.length - 1],
      latestPrices,
      ...rec,
      timestamp: new Date().toISOString(),
    });
  }

  throw new Error(`Unsupported field: ${fieldName}`);
};
