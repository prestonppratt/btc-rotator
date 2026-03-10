import { useEffect, useMemo, useState } from 'react';
import { listRecommendationSnapshots } from '../services/modelingService';
import LoadingSpinner from '../components/LoadingSpinner';

interface SnapshotRow {
  id: string;
  modelName: string;
  signalDate?: string | null;
  generatedAt: string;
  parsedSnapshot: any;
}

function RecommendationHistory() {
  const [rows, setRows] = useState<SnapshotRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState<string>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await listRecommendationSnapshots();
        const mapped = (data || [])
          .map((r: any) => ({
            id: String(r.id),
            modelName: String(r.modelName || 'Unknown'),
            signalDate: r.signalDate || null,
            generatedAt: String(r.generatedAt),
            parsedSnapshot: r.parsedSnapshot || {},
          }))
          .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
        setRows(mapped);
        if (mapped.length > 0) setSelectedId(mapped[0].id);
      } catch (e: any) {
        setError(e.message || 'Failed to load recommendation history');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  const models = useMemo(() => ['ALL', ...Array.from(new Set(rows.map((r) => r.modelName)))], [rows]);

  const filteredRows = useMemo(() => {
    if (selectedModel === 'ALL') return rows;
    return rows.filter((r) => r.modelName === selectedModel);
  }, [rows, selectedModel]);

  const selected = filteredRows.find((r) => r.id === selectedId) || filteredRows[0] || null;

  return (
    <div className="min-h-screen text-white p-4 pb-20">
      <div className="max-w-6xl mx-auto space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recommendation History</h1>
          <p className="text-sm text-gray-400">Review and replay saved model recommendation snapshots.</p>
        </div>

        {isLoading ? (
          <div className="py-12 flex items-center gap-3 text-gray-400">
            <LoadingSpinner size="sm" />
            Loading snapshots...
          </div>
        ) : error ? (
          <div className="text-red-400">{error}</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-[#1C1C1E] border border-gray-800 rounded-xl p-4 lg:col-span-1">
              <div className="mb-3">
                <label className="text-xs text-gray-500">Filter model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="mt-1 w-full bg-[#2C2C2E] border border-gray-700 rounded px-2 py-2 text-sm"
                >
                  {models.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 max-h-[520px] overflow-y-auto">
                {filteredRows.length === 0 ? (
                  <p className="text-sm text-gray-500">No snapshots yet.</p>
                ) : filteredRows.map((row) => (
                  <button
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                    className={`w-full text-left p-3 rounded border ${selected?.id === row.id ? 'border-[#0A84FF] bg-[#202126]' : 'border-gray-800 bg-[#17181D] hover:bg-[#202126]'}`}
                  >
                    <div className="text-sm font-semibold text-white">{row.modelName}</div>
                    <div className="text-xs text-gray-500">Signal: {row.signalDate || 'N/A'}</div>
                    <div className="text-xs text-gray-500">{new Date(row.generatedAt).toLocaleString()}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[#1C1C1E] border border-gray-800 rounded-xl p-4 lg:col-span-2">
              {!selected ? (
                <p className="text-gray-500">Select a snapshot to view details.</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold text-white">{selected.modelName}</h2>
                    <p className="text-xs text-gray-500">Generated: {new Date(selected.generatedAt).toLocaleString()}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="bg-[#17181D] border border-gray-800 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">Signal Date</div>
                      <div className="text-white">{selected.signalDate || 'N/A'}</div>
                    </div>
                    <div className="bg-[#17181D] border border-gray-800 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">Estimated Turnover</div>
                      <div className="text-white">
                        {selected.parsedSnapshot?.estimatedTurnover != null
                          ? `${(Number(selected.parsedSnapshot.estimatedTurnover) * 100).toFixed(2)}%`
                          : 'N/A'}
                      </div>
                    </div>
                    <div className="bg-[#17181D] border border-gray-800 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">Net Cash Impact</div>
                      <div className="text-white">
                        {selected.parsedSnapshot?.netCashImpact != null
                          ? `$${Number(selected.parsedSnapshot.netCashImpact).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : 'N/A'}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="bg-[#17181D] border border-gray-800 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-2">Sell Orders</div>
                      {(selected.parsedSnapshot?.sellOrders || []).length === 0 ? (
                        <div className="text-gray-500">None</div>
                      ) : selected.parsedSnapshot.sellOrders.map((o: any) => (
                        <div key={`sell-${o.ticker}`} className="text-red-300">{o.ticker}: {Number(o.quantity).toFixed(4)} (${Number(o.dollars).toFixed(2)})</div>
                      ))}
                    </div>
                    <div className="bg-[#17181D] border border-gray-800 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-2">Buy Orders</div>
                      {(selected.parsedSnapshot?.buyOrders || []).length === 0 ? (
                        <div className="text-gray-500">None</div>
                      ) : selected.parsedSnapshot.buyOrders.map((o: any) => (
                        <div key={`buy-${o.ticker}`} className="text-green-300">{o.ticker}: {Number(o.quantity).toFixed(4)} (${Number(o.dollars).toFixed(2)})</div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RecommendationHistory;
