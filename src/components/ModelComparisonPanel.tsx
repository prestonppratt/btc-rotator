import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import {
  getTradeRecommendations,
  listModels,
  listSavedModelConfigs,
  runModelComparison,
  saveModelSelectionConfig,
  saveRecommendationSnapshot,
  type ComparisonResponse,
  type ModelConfigInput,
  type TradeRecommendationResponse,
} from '../services/modelingService';
import LoadingSpinner from './LoadingSpinner';
import { buildMergedComparisonChartData, buildRankingRows } from '../utils/modelComparison';

const DEFAULT_UNIVERSE = ['BTC-USD', 'MSTR', 'MARA', 'ASST'];

const DEFAULT_CONFIG: ModelConfigInput = {
  models: [],
  tickers: DEFAULT_UNIVERSE,
  startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
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
};

const colorForModel = (model: string): string => {
  const palette: Record<string, string> = {
    'Actual Portfolio': '#FACC15',
    'Relative Momentum': '#0A84FF',
    'Time-Series Momentum': '#22C55E',
    'Dual Momentum': '#A855F7',
    'Volatility-Adjusted Momentum': '#14B8A6',
    'Mean Reversion': '#F97316',
    'Ensemble': '#EF4444',
  };
  return palette[model] || '#9CA3AF';
};

function ModelComparisonPanel() {
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [config, setConfig] = useState<ModelConfigInput>(DEFAULT_CONFIG);
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null);
  const [recommendations, setRecommendations] = useState<Record<string, TradeRecommendationResponse>>({});
  const [visibleModels, setVisibleModels] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [savedName, setSavedName] = useState('');
  const [savedConfigs, setSavedConfigs] = useState<Array<{ id: string; name: string; parsedConfig: any }>>([]);
  const [error, setError] = useState<string | null>(null);

  const loadModels = async () => {
    try {
      const models = await listModels();
      setAvailableModels(models);
      if (config.models.length === 0) {
        setConfig((prev) => ({ ...prev, models }));
      }
    } catch (e: any) {
      setError(e.message || 'Failed loading models');
    }
  };

  const loadSavedConfigs = async () => {
    try {
      const rows = await listSavedModelConfigs();
      setSavedConfigs((rows || []) as any);
    } catch {
      setSavedConfigs([]);
    }
  };

  const runComparison = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const selectedModels = config.models.length > 0 ? config.models : availableModels;
      const payload = { ...config, models: selectedModels };
      const data = await runModelComparison(payload);
      setComparison(data);

      const modelVisibility: Record<string, boolean> = { 'Actual Portfolio': true };
      selectedModels.forEach((m) => { modelVisibility[m] = true; });
      setVisibleModels(modelVisibility);

      const recResults = await Promise.all(selectedModels.map(async (model) => {
        const rec = await getTradeRecommendations(model, payload);
        await saveRecommendationSnapshot(model, payload, rec, rec.signalDate);
        return [model, rec] as const;
      }));
      setRecommendations(Object.fromEntries(recResults));
    } catch (e: any) {
      setError(e.message || 'Comparison failed');
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!savedName.trim()) return;
    await saveModelSelectionConfig(savedName.trim(), config);
    setSavedName('');
    await loadSavedConfigs();
  };

  const mergedChartData = useMemo(() => {
    return buildMergedComparisonChartData(comparison);
  }, [comparison]);

  const rankingRows = useMemo(() => buildRankingRows(comparison), [comparison]);

  useEffect(() => {
    if (availableModels.length === 0) {
      void loadModels();
      void loadSavedConfigs();
    }
  }, [availableModels.length]);

  return (
    <div className="bg-[#1C1C1E] border border-gray-800 rounded-xl p-4 sm:p-6 shadow-premium mt-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
        <div>
          <h2 className="text-xl font-semibold text-white">Model Selection & Trade Recommendations</h2>
          <p className="text-sm text-gray-400">Compare model backtests against your actual portfolio and generate current rebalance trades.</p>
        </div>
        <button onClick={runComparison} className="px-4 py-2 bg-[#0A84FF] text-white rounded-lg font-semibold hover:bg-[#0066CC]">
          Run Comparison
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
        <div className="xl:col-span-2 bg-[#22242A] border border-gray-700 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-2">Models</div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setConfig((p) => ({ ...p, models: availableModels }))}
              className="px-2 py-1 text-xs bg-[#2D3038] rounded text-gray-300 hover:text-white"
            >
              All Models
            </button>
            {availableModels.map((model) => (
              <label key={model} className="text-xs text-gray-300 inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={config.models.includes(model)}
                  onChange={(e) => {
                    setConfig((prev) => ({
                      ...prev,
                      models: e.target.checked
                        ? [...prev.models, model]
                        : prev.models.filter((m) => m !== model),
                    }));
                  }}
                />
                {model}
              </label>
            ))}
          </div>
        </div>

        <label className="bg-[#22242A] border border-gray-700 rounded-lg p-3 text-xs text-gray-400">
          Start
          <input type="date" value={config.startDate} onChange={(e) => setConfig({ ...config, startDate: e.target.value })} className="mt-1 w-full bg-[#2D3038] text-white rounded px-2 py-1" />
        </label>
        <label className="bg-[#22242A] border border-gray-700 rounded-lg p-3 text-xs text-gray-400">
          End
          <input type="date" value={config.endDate} onChange={(e) => setConfig({ ...config, endDate: e.target.value })} className="mt-1 w-full bg-[#2D3038] text-white rounded px-2 py-1" />
        </label>
        <label className="bg-[#22242A] border border-gray-700 rounded-lg p-3 text-xs text-gray-400">
          Rebalance
          <select value={config.rebalanceFrequency} onChange={(e) => setConfig({ ...config, rebalanceFrequency: e.target.value as any })} className="mt-1 w-full bg-[#2D3038] text-white rounded px-2 py-1">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        <label className="bg-[#22242A] border border-gray-700 rounded-lg p-3 text-xs text-gray-400">
          Top-N
          <select value={config.topN} onChange={(e) => setConfig({ ...config, topN: Number(e.target.value) as 1 | 2 })} className="mt-1 w-full bg-[#2D3038] text-white rounded px-2 py-1">
            <option value={1}>Top-1</option>
            <option value={2}>Top-2</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
        <label className="text-xs text-gray-500">Cash Allowed
          <input type="checkbox" checked={config.cashAllowed} onChange={(e) => setConfig({ ...config, cashAllowed: e.target.checked })} className="ml-2" />
        </label>
        <label className="text-xs text-gray-500">Lookback
          <input type="number" value={config.lookback} onChange={(e) => setConfig({ ...config, lookback: Number(e.target.value) })} className="mt-1 w-full bg-[#2D3038] text-white rounded px-2 py-1" />
        </label>
        <label className="text-xs text-gray-500">Tx Cost (bps)
          <input type="number" value={config.transactionCostBps} onChange={(e) => setConfig({ ...config, transactionCostBps: Number(e.target.value) })} className="mt-1 w-full bg-[#2D3038] text-white rounded px-2 py-1" />
        </label>
        <label className="text-xs text-gray-500">Slippage (bps)
          <input type="number" value={config.slippageBps} onChange={(e) => setConfig({ ...config, slippageBps: Number(e.target.value) })} className="mt-1 w-full bg-[#2D3038] text-white rounded px-2 py-1" />
        </label>
        <label className="text-xs text-gray-500">Execution
          <select value={config.execution} onChange={(e) => setConfig({ ...config, execution: e.target.value as any })} className="mt-1 w-full bg-[#2D3038] text-white rounded px-2 py-1">
            <option value="next_close">Next Close</option>
            <option value="next_open">Next Open</option>
          </select>
        </label>
        <label className="text-xs text-gray-500">Round Lots
          <select value={config.roundLots} onChange={(e) => setConfig({ ...config, roundLots: e.target.value as any })} className="mt-1 w-full bg-[#2D3038] text-white rounded px-2 py-1">
            <option value="auto">Auto</option>
            <option value="fractional">Fractional</option>
            <option value="whole">Whole</option>
          </select>
        </label>
      </div>

      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <input
          value={savedName}
          onChange={(e) => setSavedName(e.target.value)}
          placeholder="Save config name"
          className="bg-[#2D3038] border border-gray-700 rounded px-3 py-2 text-sm text-white"
        />
        <button onClick={saveConfig} className="px-3 py-2 bg-[#2D3038] text-white rounded">Save Config</button>
        <select
          onChange={(e) => {
            const row = savedConfigs.find((r) => r.id === e.target.value);
            if (row?.parsedConfig) setConfig(row.parsedConfig);
          }}
          className="bg-[#2D3038] border border-gray-700 rounded px-3 py-2 text-sm text-white"
        >
          <option value="">Load saved config</option>
          {savedConfigs.map((row) => (
            <option key={row.id} value={row.id}>{row.name}</option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div className="py-6 flex items-center gap-3 text-gray-400">
          <LoadingSpinner size="sm" />
          Running model comparison and recommendations...
        </div>
      )}
      {error && <div className="text-red-400 text-sm mb-3">{error}</div>}

      {comparison && (
        <>
          <div className="bg-[#15161B] border border-gray-800 rounded-lg p-3 mb-4">
            <div className="text-sm text-gray-300 mb-2">Performance Comparison (normalized to common start)</div>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={mergedChartData}>
                <CartesianGrid stroke="#2B2F38" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#6B7280" />
                <YAxis stroke="#6B7280" />
                <Tooltip />
                <Legend />
                {Object.keys(visibleModels).filter((name) => visibleModels[name]).map((name) => (
                  <Line key={name} type="monotone" dataKey={name} stroke={colorForModel(name)} dot={false} strokeWidth={name === 'Actual Portfolio' ? 3 : 2} />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 mt-2">
              {Object.keys(visibleModels).map((name) => (
                <label key={name} className="text-xs text-gray-400 inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={visibleModels[name]}
                    onChange={(e) => setVisibleModels((prev) => ({ ...prev, [name]: e.target.checked }))}
                  />
                  {name}
                </label>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead className="bg-[#22242A] text-gray-400 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Model</th>
                  <th className="px-3 py-2 text-right">Total Return</th>
                  <th className="px-3 py-2 text-right">CAGR</th>
                  <th className="px-3 py-2 text-right">Sharpe</th>
                  <th className="px-3 py-2 text-right">Max DD</th>
                  <th className="px-3 py-2 text-right">Turnover</th>
                  <th className="px-3 py-2 text-right">Rank</th>
                  <th className="px-3 py-2 text-right">Vs Actual</th>
                </tr>
              </thead>
              <tbody>
                {rankingRows.map((row) => {
                  return (
                    <tr key={row.model} className="border-t border-gray-800">
                      <td className="px-3 py-2 text-white">
                        {row.model} {row.bestOverPeriod ? <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-green-900/40 text-green-300">Best over selected period</span> : null}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-300">{(row.totalReturn * 100).toFixed(2)}%</td>
                      <td className="px-3 py-2 text-right text-gray-300">{(row.cagr * 100).toFixed(2)}%</td>
                      <td className="px-3 py-2 text-right text-gray-300">{row.sharpe.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{(row.maxDrawdown * 100).toFixed(2)}%</td>
                      <td className="px-3 py-2 text-right text-gray-300">{(row.turnover * 100).toFixed(2)}%</td>
                      <td className="px-3 py-2 text-right text-white font-semibold">{row.rank}</td>
                      <td className={`px-3 py-2 text-right ${row.deltaVsActual >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {row.deltaVsActual >= 0 ? '+' : ''}{(row.deltaVsActual * 100).toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3">
            {Object.entries(recommendations).map(([model, rec]) => (
              <div key={model} className="border border-gray-800 rounded-lg p-3 bg-[#17181D]">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-white font-semibold">{model}</div>
                  <div className="text-xs text-gray-500">Signal: {rec.signalDate} • Generated: {new Date(rec.timestamp).toLocaleString()}</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Target Weights</div>
                    {Object.entries(rec.targetWeights).map(([ticker, w]) => (
                      <div key={ticker} className="text-gray-300">{ticker}: {(w * 100).toFixed(2)}%</div>
                    ))}
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Sell</div>
                    {rec.sellOrders.length === 0 ? <div className="text-gray-500">None</div> : rec.sellOrders.map((o) => (
                      <div key={o.ticker} className="text-red-300">{o.ticker}: {o.quantity.toFixed(4)} ({o.dollars.toFixed(2)}$)</div>
                    ))}
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Buy</div>
                    {rec.buyOrders.length === 0 ? <div className="text-gray-500">None</div> : rec.buyOrders.map((o) => (
                      <div key={o.ticker} className="text-green-300">{o.ticker}: {o.quantity.toFixed(4)} ({o.dollars.toFixed(2)}$)</div>
                    ))}
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Estimated turnover: {(rec.estimatedTurnover * 100).toFixed(2)}% • Net cash impact: {rec.netCashImpact.toFixed(2)}$
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default ModelComparisonPanel;
