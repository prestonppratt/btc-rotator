import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

export interface ModelConfigInput {
  models: string[];
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

export interface ModelMetrics {
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

export interface ModelResult {
  model: string;
  latestSignalDate: string;
  latestTargetWeights: Record<string, number>;
  metrics: ModelMetrics;
  series: Array<{ date: string; equity: number }>;
}

export interface ComparisonResponse {
  config: ModelConfigInput;
  dates: string[];
  actualSeries: Array<{ date: string; equity: number }>;
  models: ModelResult[];
  ranking: Array<{ model: string; metrics: ModelMetrics; rank: number; bestOverPeriod: boolean }>;
}

export interface TradeRecommendationResponse {
  model: string;
  signalDate: string;
  latestPrices: Record<string, number>;
  targetAllocations: Record<string, number>;
  targetWeights: Record<string, number>;
  sellOrders: Array<{ ticker: string; quantity: number; dollars: number }>;
  buyOrders: Array<{ ticker: string; quantity: number; dollars: number }>;
  netCashImpact: number;
  estimatedTurnover: number;
  notes: string[];
  timestamp: string;
}

export const listModels = async (): Promise<string[]> => {
  const res = await client.queries.listModels();
  if (res.errors) throw new Error(res.errors.map((e) => e.message).join(', '));
  return (res.data || []).filter((m): m is string => typeof m === 'string');
};

export const runModelComparison = async (config: Partial<ModelConfigInput>): Promise<ComparisonResponse> => {
  const res = await client.queries.runModelComparison({ config });
  if (res.errors) throw new Error(res.errors.map((e) => e.message).join(', '));
  return JSON.parse(res.data || '{}') as ComparisonResponse;
};

export const getTradeRecommendations = async (
  model: string,
  config: Partial<ModelConfigInput>,
  currentHoldings?: Record<string, number>
): Promise<TradeRecommendationResponse> => {
  const res = await client.queries.getTradeRecommendations({
    model,
    config,
    currentHoldings,
  });
  if (res.errors) throw new Error(res.errors.map((e) => e.message).join(', '));
  return JSON.parse(res.data || '{}') as TradeRecommendationResponse;
};

export const saveModelSelectionConfig = async (name: string, config: ModelConfigInput, isDefault = false) => {
  const res = await client.models.ModelSelectionConfig.create({
    name,
    config,
    isDefault,
    lastRunAt: new Date().toISOString(),
  });
  if (res.errors) throw new Error(res.errors.map((e) => e.message).join(', '));
  return res.data;
};

export const listSavedModelConfigs = async () => {
  const res = await client.models.ModelSelectionConfig.list();
  if (res.errors) throw new Error(res.errors.map((e) => e.message).join(', '));
  return (res.data || []).map((row) => ({
    ...row,
    parsedConfig: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
  }));
};

export const saveRecommendationSnapshot = async (modelName: string, config: any, snapshot: any, signalDate?: string) => {
  const res = await client.models.RecommendationSnapshot.create({
    modelName,
    config,
    snapshot,
    signalDate: signalDate || null,
    generatedAt: new Date().toISOString(),
  });
  if (res.errors) throw new Error(res.errors.map((e) => e.message).join(', '));
  return res.data;
};

export const listRecommendationSnapshots = async () => {
  const res = await client.models.RecommendationSnapshot.list({
    limit: 200,
  });
  if (res.errors) throw new Error(res.errors.map((e) => e.message).join(', '));
  return (res.data || []).map((row) => ({
    ...row,
    parsedConfig: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
    parsedSnapshot: typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot,
  }));
};
