import { useEffect, useState, useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { SUPPORTED_TICKERS, TICKER_NAMES } from '../constants/tickers';
import LoadingSpinner from '../components/LoadingSpinner';
import { getCurrentUser } from 'aws-amplify/auth';
import { TrashIcon } from '@heroicons/react/24/outline';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { useDenomination } from '../contexts/DenominationContext';
import { getPortfolioStorageKeys, getPrimaryPortfolioStorageKey } from '../utils/userStorage';

const client = generateClient<Schema>();

interface Holding {
  ticker: string;
  shares: number;
  pricePerShare: number; // Average cost basis in USD
  isLoadingPrice?: boolean;
}

interface DisplayHolding extends Holding {
  currentPriceUSD: number;
}

interface PortfolioTransaction {
  id: string;
  ticker: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  priceUSD: number;
  timestamp: number;
}

type SortKey =
  | 'symbol'
  | 'lastPrice'
  | 'currentValue'
  | 'accountPct'
  | 'quantity'
  | 'avgCost'
  | 'costBasisTotal'
  | 'gainLoss'
  | 'gainLossPct';

type SortDirection = 'asc' | 'desc';

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

type ColumnId =
  | 'symbol'
  | 'lastPrice'
  | 'currentValue'
  | 'accountPct'
  | 'quantity'
  | 'avgCost'
  | 'costBasisTotal'
  | 'gainLoss'
  | 'gainLossPct';

const DEFAULT_COLUMN_ORDER: ColumnId[] = [
  'symbol',
  'lastPrice',
  'currentValue',
  'accountPct',
  'quantity',
  'avgCost',
  'costBasisTotal',
  'gainLoss',
  'gainLossPct',
];

// Helper to fetch Bitcoin price from CoinGecko API
const fetchBitcoinPrice = async (): Promise<number> => {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    const data = await response.json();
    if (data?.bitcoin?.usd) {
      return data.bitcoin.usd;
    }
    return 0;
  } catch (e) {
    console.error('Bitcoin price fetch error', e);
    return 0;
  }
};

// Helper to fetch stock price - tries multiple methods
const fetchStockPrice = async (symbol: string): Promise<number> => {
  // Method 1: Try Yahoo Finance v8 API (newer endpoint) with User-Agent header
  try {
    const response = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (response.ok) {
      const data = await response.json();
      const result = data?.chart?.result?.[0];
      if (result?.meta?.regularMarketPrice) {
        const price = result.meta.regularMarketPrice;
        if (price > 0) return price;
      }
      // Fallback to previous close
      if (result?.meta?.chartPreviousClose) {
        const price = result.meta.chartPreviousClose;
        if (price > 0) return price;
      }
    }
  } catch (e) {
    console.warn('Yahoo Finance v8 fetch failed for', symbol, e);
  }

  // Method 2: Try with CORS proxy as fallback (using v8 endpoint)
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`)}`;
    const response = await fetch(proxyUrl);
    const data = await response.json();
    const result = data?.chart?.result?.[0];
    if (result?.meta?.regularMarketPrice) {
      const price = result.meta.regularMarketPrice;
      if (price > 0) return price;
    }
    if (result?.meta?.chartPreviousClose) {
      const price = result.meta.chartPreviousClose;
      if (price > 0) return price;
    }
  } catch (e) {
    console.warn('CORS proxy fetch failed for', symbol, e);
  }

  console.error('All price fetch methods failed for', symbol);
  return 0;
};

// Unified price fetcher that handles both crypto and stocks
const fetchPrice = async (symbol: string): Promise<number> => {
  // Handle Bitcoin separately using CoinGecko
  if (symbol === 'BTC-USD') {
    return await fetchBitcoinPrice();
  }

  // Handle all stocks using Yahoo Finance
  return await fetchStockPrice(symbol);
};

// Helper to format Bitcoin values with commas
const formatBitcoin = (value: number): string => {
  // For Bitcoin, show more decimal places for smaller values
  if (value >= 1) {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    });
  } else if (value >= 0.01) {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 6,
      maximumFractionDigits: 6
    });
  } else {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 8,
      maximumFractionDigits: 8
    });
  }
};

function Portfolio() {
  const { denomination } = useDenomination();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [bitcoinPrice, setBitcoinPrice] = useState<number>(0);
  const [selectedAssetsToAdd, setSelectedAssetsToAdd] = useState<string[]>([]);
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([]);
  const [txTicker, setTxTicker] = useState<string>('BTC-USD');
  const [txType, setTxType] = useState<'BUY' | 'SELL'>('BUY');
  const [txQuantity, setTxQuantity] = useState<string>('');
  const [txPriceUSD, setTxPriceUSD] = useState<string>('');
  const [txDate, setTxDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'currentValue', direction: 'desc' });
  const [columnOrder, setColumnOrder] = useState<ColumnId[]>(DEFAULT_COLUMN_ORDER);
  const [draggedColumn, setDraggedColumn] = useState<ColumnId | null>(null);

  // Fetch Bitcoin price using useQuery
  const { data: btcPriceData } = useQuery({
    queryKey: ['bitcoinPrice'],
    queryFn: fetchBitcoinPrice,
    refetchInterval: 30000,
    staleTime: 1000 * 60, // 1 minute
  });

  // Update bitcoinPrice state when query data changes (for compatibility)
  useEffect(() => {
    if (btcPriceData && btcPriceData > 0) {
      setBitcoinPrice(btcPriceData);
    }
  }, [btcPriceData]);

  // Fetch prices for all holdings using useQueries
  const priceQueries = useQueries({
    queries: holdings.map(h => ({
      queryKey: ['price', h.ticker],
      queryFn: () => fetchPrice(h.ticker),
      refetchInterval: 30000,
      staleTime: 1000 * 60, // 1 minute
      enabled: !!h.ticker,
    }))
  });

  // Derive display holdings by merging state with query data
  const displayHoldings: DisplayHolding[] = useMemo(() => {
    return holdings.map((h, index) => {
      const query = priceQueries[index];
      const livePrice = query?.data;
      const isLoading = query?.isLoading;

      return {
        ...h,
        currentPriceUSD: (livePrice && livePrice > 0) ? livePrice : 0,
        isLoadingPrice: Boolean(isLoading) && !(livePrice && livePrice > 0), // Only show loading if we have no live price
      };
    });
  }, [holdings, priceQueries]);

  const availableTickers = useMemo(
    () => SUPPORTED_TICKERS.filter((ticker) => !holdings.some((h) => h.ticker === ticker)),
    [holdings]
  );

  // Convert USD price to Bitcoin price
  const usdToBtc = (usdPrice: number): number => {
    if (bitcoinPrice > 0) {
      return usdPrice / bitcoinPrice;
    }
    return 0;
  };

  // Functions to add and remove holdings
  const addSelectedHoldings = () => {
    if (selectedAssetsToAdd.length === 0) {
      return;
    }
    const holdingsToAdd: Holding[] = selectedAssetsToAdd
      .filter((ticker) => !holdings.some((h) => h.ticker === ticker))
      .map((ticker) => ({
        ticker,
        shares: 0,
        pricePerShare: 0,
        isLoadingPrice: true,
      }));

    if (holdingsToAdd.length === 0) {
      setSelectedAssetsToAdd([]);
      return;
    }

    setHoldings([...holdings, ...holdingsToAdd]);
    setSelectedAssetsToAdd([]);
  };

  const removeHolding = (ticker: string) => {
    setHoldings(holdings.filter((h) => h.ticker !== ticker));
  };

  const updateShares = (ticker: string, shares: number) => {
    setHoldings(holdings.map((h) => (h.ticker === ticker ? { ...h, shares } : h)));
  };

  const updateAvgCost = (ticker: string, avgCost: number) => {
    setHoldings(holdings.map((h) => (h.ticker === ticker ? { ...h, pricePerShare: avgCost } : h)));
  };

  // Calculate total value in Bitcoin using displayHoldings
  const totalValue = displayHoldings.reduce((sum, h) => {
    const usdValue = h.currentPriceUSD * h.shares;
    return sum + usdToBtc(usdValue);
  }, 0);

  const totalValueUSD = displayHoldings.reduce((sum, h) => sum + (h.currentPriceUSD * h.shares), 0);

  const portfolioRows = useMemo(() => {
    return displayHoldings.map((h) => {
      const currentValue = h.currentPriceUSD * h.shares;
      const costBasisTotal = h.pricePerShare * h.shares;
      const gainLoss = currentValue - costBasisTotal;
      const gainLossPct = costBasisTotal > 0 ? (gainLoss / costBasisTotal) * 100 : 0;
      const accountPct = totalValueUSD > 0 ? (currentValue / totalValueUSD) * 100 : 0;

      return {
        ...h,
        currentValue,
        costBasisTotal,
        gainLoss,
        gainLossPct,
        accountPct,
      };
    });
  }, [displayHoldings, totalValueUSD]);

  const sortedPortfolioRows = useMemo(() => {
    const rows = [...portfolioRows];
    const directionMultiplier = sortConfig.direction === 'asc' ? 1 : -1;

    rows.sort((a, b) => {
      switch (sortConfig.key) {
        case 'symbol':
          return a.ticker.localeCompare(b.ticker) * directionMultiplier;
        case 'lastPrice':
          return (a.currentPriceUSD - b.currentPriceUSD) * directionMultiplier;
        case 'currentValue':
          return (a.currentValue - b.currentValue) * directionMultiplier;
        case 'accountPct':
          return (a.accountPct - b.accountPct) * directionMultiplier;
        case 'quantity':
          return (a.shares - b.shares) * directionMultiplier;
        case 'avgCost':
          return (a.pricePerShare - b.pricePerShare) * directionMultiplier;
        case 'costBasisTotal':
          return (a.costBasisTotal - b.costBasisTotal) * directionMultiplier;
        case 'gainLoss':
          return (a.gainLoss - b.gainLoss) * directionMultiplier;
        case 'gainLossPct':
          return (a.gainLossPct - b.gainLossPct) * directionMultiplier;
        default:
          return 0;
      }
    });

    return rows;
  }, [portfolioRows, sortConfig]);

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'desc' };
    });
  };

  const sortIndicator = (key: SortKey) => {
    if (sortConfig.key !== key) return '↕';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const onHeaderDragStart = (column: ColumnId) => {
    setDraggedColumn(column);
  };

  const onHeaderDrop = (targetColumn: ColumnId) => {
    if (!draggedColumn || draggedColumn === targetColumn) return;

    setColumnOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(draggedColumn);
      const to = next.indexOf(targetColumn);
      if (from < 0 || to < 0) return prev;
      next.splice(from, 1);
      next.splice(to, 0, draggedColumn);
      return next;
    });
    setDraggedColumn(null);
  };

  const getColumnLabel = (column: ColumnId): string => {
    switch (column) {
      case 'symbol': return 'Symbol';
      case 'lastPrice': return 'Last Price';
      case 'currentValue': return 'Current Value';
      case 'accountPct': return '% Account';
      case 'quantity': return 'Quantity';
      case 'avgCost': return 'Avg Cost Basis';
      case 'costBasisTotal': return 'Cost Basis Total';
      case 'gainLoss': return 'Total Gain/Loss $';
      case 'gainLossPct': return 'Total Gain/Loss %';
      default: return '';
    }
  };

  const formatUSD = (value: number): string =>
    `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatPercent = (value: number): string =>
    `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

  const addTransaction = () => {
    const quantity = parseFloat(txQuantity);
    const priceUSD = parseFloat(txPriceUSD);
    const timestamp = new Date(txDate).getTime();

    if (!txTicker || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(priceUSD) || priceUSD <= 0 || !Number.isFinite(timestamp)) {
      setMessage({ type: 'error', text: 'Enter a valid transaction (ticker, quantity, price, date).' });
      return;
    }

    const tx: PortfolioTransaction = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ticker: txTicker,
      type: txType,
      quantity,
      priceUSD,
      timestamp,
    };

    setTransactions((prev) => [tx, ...prev].sort((a, b) => b.timestamp - a.timestamp));
    setTxQuantity('');
    setTxPriceUSD('');
    setMessage({ type: 'success', text: 'Transaction added. Save portfolio to persist it.' });
  };

  const removeTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((tx) => tx.id !== id));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const user = await getCurrentUser();
      // Save user-entered portfolio ledger values (quantity + average cost basis)
      const holdingsToSave = holdings.map(({ ticker, shares, pricePerShare }) => ({
        ticker,
        shares,
        pricePerShare,
      }));

      // Check if user exists
      const userData = await client.models.User.get({ id: user.userId });

      if (userData.data) {
        // Update existing user
        await client.models.User.update({
          id: user.userId,
          portfolio: JSON.stringify(holdingsToSave),
          tradeHistory: JSON.stringify(transactions),
        });
      } else {
        // Create new user record
        await client.models.User.create({
          id: user.userId,
          email: user.signInDetails?.loginId || user.username || user.userId,
          signupDate: new Date().toISOString(),
          notificationFreq: 'weekly', // Default
          portfolio: JSON.stringify(holdingsToSave),
          tradeHistory: JSON.stringify(transactions),
          isPaid: false
        });
      }

      // Also save to local storage as backup/cache
      localStorage.setItem(getPrimaryPortfolioStorageKey(user), JSON.stringify(holdingsToSave));

      // Dispatch custom event to notify Dashboard
      window.dispatchEvent(new Event('portfolioUpdated'));
      setMessage({ type: 'success', text: 'Stack saved to cloud.' });
    } catch (e) {
      console.error(e);
      setMessage({ type: 'error', text: 'Failed to save stack to cloud.' });
    }
    setIsSaving(false);
  };

  const loadPortfolio = async () => {
    setMessage(null);
    try {
      const user = await getCurrentUser();

      // Try loading from backend first
      const userData = await client.models.User.get({ id: user.userId });
      let loadedHoldings: Holding[] | null = null;
      let loadedTransactions: PortfolioTransaction[] = [];

      if (userData.data?.portfolio) {
        // Backend has data
        if (typeof userData.data.portfolio === 'string') {
          loadedHoldings = JSON.parse(userData.data.portfolio);
        } else {
          loadedHoldings = userData.data.portfolio as unknown as Holding[];
        }
        if (userData.data.tradeHistory) {
          const parsed = typeof userData.data.tradeHistory === 'string'
            ? JSON.parse(userData.data.tradeHistory)
            : userData.data.tradeHistory;
          if (Array.isArray(parsed)) {
            loadedTransactions = parsed
              .map((tx: any): PortfolioTransaction => ({
                id: String(tx.id || `${tx.ticker}_${tx.timestamp}`),
                ticker: String(tx.ticker || ''),
                type: tx.type === 'SELL' ? 'SELL' : 'BUY',
                quantity: Number(tx.quantity || 0),
                priceUSD: Number(tx.priceUSD || 0),
                timestamp: Number(tx.timestamp || 0),
              }))
              .filter((tx: PortfolioTransaction) =>
                Boolean(tx.ticker) &&
                SUPPORTED_TICKERS.includes(tx.ticker as any) &&
                tx.quantity > 0 &&
                tx.priceUSD > 0 &&
                tx.timestamp > 0
              )
              .sort((a: PortfolioTransaction, b: PortfolioTransaction) => b.timestamp - a.timestamp);
          }
        }
      } else {
        // Fallback to local storage if backend is empty
        for (const storageKey of getPortfolioStorageKeys(user)) {
          const saved = localStorage.getItem(storageKey);
          if (saved) {
            loadedHoldings = JSON.parse(saved);
            break;
          }
        }
      }

      if (loadedHoldings) {
        // Migrate old format to new format
        const migrated = loadedHoldings.map(h => ({
          ...h,
          pricePerShare: Number((h as any).pricePerShare ?? 0),
          shares: Number((h as any).shares ?? 0),
          isLoadingPrice: false
        })).filter((h) => SUPPORTED_TICKERS.includes(h.ticker as any));
        setHoldings(migrated);
        setTransactions(loadedTransactions);
        setMessage({ type: 'success', text: 'Stack loaded from cloud.' });
      } else {
        setMessage({ type: 'error', text: 'No saved stack found.' });
      }
    } catch (e) {
      console.error(e);
      setMessage({ type: 'error', text: 'Failed to load stack.' });
    }
  };

  // Initial load effect
  useEffect(() => {
    loadPortfolio();
  }, []);

  return (
    <div className="min-h-screen text-white p-4 pb-20">
      <div className="max-w-[1400px] mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-white tracking-tight">Portfolio</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
          <div className="bg-[#1C1C1E] border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Current Value</div>
            <div className="text-2xl font-semibold text-white">{formatUSD(totalValueUSD)}</div>
          </div>
          <div className="bg-[#1C1C1E] border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">BTC Value</div>
            <div className="text-2xl font-semibold text-white">
              {denomination === 'Sats'
                ? `${(totalValue * 100000000).toLocaleString(undefined, { maximumFractionDigits: 0 })} sats`
                : `₿${formatBitcoin(totalValue)}`
              }
            </div>
          </div>
          <div className="bg-[#1C1C1E] border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Positions</div>
            <div className="text-2xl font-semibold text-white">{displayHoldings.length}</div>
          </div>
        </div>

        <div className="bg-[#1C1C1E] border border-gray-800 rounded-xl overflow-hidden shadow-premium">
          <div className="overflow-x-auto hidden md:block">
            <table className="min-w-[1200px] w-full">
              <thead>
                <tr className="bg-[#2C2C2E] text-[11px] uppercase tracking-wider text-gray-400">
                  {columnOrder.map((column) => (
                    <th
                      key={column}
                      draggable
                      onDragStart={() => onHeaderDragStart(column)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => onHeaderDrop(column)}
                      onDragEnd={() => setDraggedColumn(null)}
                      className={`px-4 py-3 font-semibold ${column === 'symbol' ? 'text-left' : 'text-right'} ${draggedColumn === column ? 'opacity-40' : ''}`}
                      title="Drag to reorder columns"
                    >
                      <button onClick={() => handleSort(column as SortKey)} className="inline-flex items-center gap-1 hover:text-white transition-colors">
                        {getColumnLabel(column)} <span>{sortIndicator(column as SortKey)}</span>
                      </button>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center font-semibold w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {displayHoldings.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-10 text-center text-gray-500">
                      No positions yet. Add a symbol above to begin.
                    </td>
                  </tr>
                ) : (
                  sortedPortfolioRows.map((h) => {
                    return (
                      <tr key={h.ticker} className="hover:bg-[#2C2C2E]/40 transition-colors">
                        {columnOrder.map((column) => {
                          switch (column) {
                            case 'symbol':
                              return (
                                <td key={column} className="px-4 py-3">
                                  <div className="font-semibold text-white">{h.ticker}</div>
                                  <div className="text-xs text-gray-500">{TICKER_NAMES[h.ticker as keyof typeof TICKER_NAMES] || h.ticker}</div>
                                </td>
                              );
                            case 'lastPrice':
                              return (
                                <td key={column} className="px-4 py-3 text-right font-mono text-gray-200">
                                  {h.isLoadingPrice ? <span className="text-xs text-gray-500">Loading...</span> : formatUSD(h.currentPriceUSD)}
                                </td>
                              );
                            case 'currentValue':
                              return <td key={column} className="px-4 py-3 text-right font-mono text-white">{formatUSD(h.currentValue)}</td>;
                            case 'accountPct':
                              return <td key={column} className="px-4 py-3 text-right font-mono text-gray-300">{h.accountPct.toFixed(2)}%</td>;
                            case 'quantity':
                              return (
                                <td key={column} className="px-4 py-3 text-right">
                                  <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    value={h.shares || ''}
                                    onChange={(e) => updateShares(h.ticker, parseFloat(e.target.value) || 0)}
                                    className="w-24 text-right bg-[#2C2C2E] border border-gray-700 rounded-md px-2 py-1.5 focus:border-[#0A84FF] focus:ring-1 focus:ring-[#0A84FF] focus:outline-none text-white"
                                  />
                                </td>
                              );
                            case 'avgCost':
                              return (
                                <td key={column} className="px-4 py-3 text-right">
                                  <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    value={h.pricePerShare || ''}
                                    onChange={(e) => updateAvgCost(h.ticker, parseFloat(e.target.value) || 0)}
                                    className="w-28 text-right bg-[#2C2C2E] border border-gray-700 rounded-md px-2 py-1.5 focus:border-[#0A84FF] focus:ring-1 focus:ring-[#0A84FF] focus:outline-none text-white"
                                  />
                                </td>
                              );
                            case 'costBasisTotal':
                              return <td key={column} className="px-4 py-3 text-right font-mono text-gray-200">{formatUSD(h.costBasisTotal)}</td>;
                            case 'gainLoss':
                              return (
                                <td key={column} className={`px-4 py-3 text-right font-mono ${h.gainLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {h.gainLoss >= 0 ? '+' : '-'}{formatUSD(Math.abs(h.gainLoss))}
                                </td>
                              );
                            case 'gainLossPct':
                              return (
                                <td key={column} className={`px-4 py-3 text-right font-mono ${h.gainLossPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {formatPercent(h.gainLossPct)}
                                </td>
                              );
                            default:
                              return null;
                          }
                        })}
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => removeHolding(h.ticker)}
                            className="text-gray-500 hover:text-[#FF3B30] transition-colors p-1.5 rounded-md hover:bg-[#FF3B30]/10"
                            title="Remove position"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3 p-3">
            {displayHoldings.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No positions yet. Add a symbol above to begin.
              </div>
            ) : (
              sortedPortfolioRows.map((h) => {
                return (
                  <div key={h.ticker} className="bg-[#202126] border border-gray-800 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-semibold text-white">{h.ticker}</div>
                        <div className="text-xs text-gray-500">{TICKER_NAMES[h.ticker as keyof typeof TICKER_NAMES] || h.ticker}</div>
                      </div>
                      <button onClick={() => removeHolding(h.ticker)} className="text-gray-500 hover:text-[#FF3B30]">
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-gray-500 text-xs">Last Price</div>
                        <div className="text-white">{h.isLoadingPrice ? 'Loading...' : formatUSD(h.currentPriceUSD)}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-xs">Current Value</div>
                        <div className="text-white">{formatUSD(h.currentValue)}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-xs">Quantity</div>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={h.shares || ''}
                          onChange={(e) => updateShares(h.ticker, parseFloat(e.target.value) || 0)}
                          className="w-full mt-1 bg-[#2C2C2E] border border-gray-700 rounded-md px-2 py-1.5 text-white"
                        />
                      </div>
                      <div>
                        <div className="text-gray-500 text-xs">Avg Cost Basis</div>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={h.pricePerShare || ''}
                          onChange={(e) => updateAvgCost(h.ticker, parseFloat(e.target.value) || 0)}
                          className="w-full mt-1 bg-[#2C2C2E] border border-gray-700 rounded-md px-2 py-1.5 text-white"
                        />
                      </div>
                      <div>
                        <div className="text-gray-500 text-xs">Cost Basis Total</div>
                        <div className="text-white">{formatUSD(h.costBasisTotal)}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-xs">Total Gain/Loss</div>
                        <div className={h.gainLoss >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {h.gainLoss >= 0 ? '+' : '-'}{formatUSD(Math.abs(h.gainLoss))} ({formatPercent(h.gainLossPct)})
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="px-4 py-4 border-t border-gray-800 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="text-sm text-gray-400">
              {denomination === 'Sats'
                ? `Total Stack: ${(totalValue * 100000000).toLocaleString(undefined, { maximumFractionDigits: 0 })} sats`
                : `Total Stack: ₿${formatBitcoin(totalValue)}`
              }
            </div>
            <div className="flex gap-2">
              <button
                onClick={loadPortfolio}
                className="px-4 py-2 bg-[#2C2C2E] text-white font-medium rounded-lg hover:bg-[#3A3A3C] transition-colors border border-gray-700"
              >
                Reload
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-[#0A84FF] text-white font-semibold rounded-lg hover:bg-[#0066CC] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {isSaving ? <LoadingSpinner size="sm" /> : 'Save Portfolio'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-[#1C1C1E] border border-gray-800 rounded-xl shadow-premium mt-6">
          <div className="p-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Transactions (For Performance History)</h2>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-3">
              <label className="block text-xs text-gray-500 mb-1">Ticker</label>
              <select
                value={txTicker}
                onChange={(e) => setTxTicker(e.target.value)}
                className="w-full bg-[#2C2C2E] text-white border border-gray-700 rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#0A84FF] focus:ring-1 focus:ring-[#0A84FF]"
              >
                {SUPPORTED_TICKERS.map((ticker) => (
                  <option key={ticker} value={ticker}>{ticker}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Type</label>
              <select
                value={txType}
                onChange={(e) => setTxType(e.target.value as 'BUY' | 'SELL')}
                className="w-full bg-[#2C2C2E] text-white border border-gray-700 rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#0A84FF] focus:ring-1 focus:ring-[#0A84FF]"
              >
                <option value="BUY">Buy</option>
                <option value="SELL">Sell</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Quantity</label>
              <input
                type="number"
                min="0"
                step="any"
                value={txQuantity}
                onChange={(e) => setTxQuantity(e.target.value)}
                className="w-full bg-[#2C2C2E] text-white border border-gray-700 rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#0A84FF] focus:ring-1 focus:ring-[#0A84FF]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Price ($)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={txPriceUSD}
                onChange={(e) => setTxPriceUSD(e.target.value)}
                className="w-full bg-[#2C2C2E] text-white border border-gray-700 rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#0A84FF] focus:ring-1 focus:ring-[#0A84FF]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <input
                type="date"
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className="w-full bg-[#2C2C2E] text-white border border-gray-700 rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#0A84FF] focus:ring-1 focus:ring-[#0A84FF]"
              />
            </div>
            <div className="md:col-span-1">
              <button
                onClick={addTransaction}
                className="w-full px-3 py-2.5 bg-[#0A84FF] text-white font-semibold rounded-lg hover:bg-[#0066CC] transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          <div className="px-4 pb-4">
            {transactions.length === 0 ? (
              <p className="text-xs text-gray-500">No transactions yet. Add buys/sells so Dashboard can compute true stack performance over time.</p>
            ) : (
              <div className="max-h-44 overflow-y-auto border border-gray-800 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-[#202126] text-gray-400 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-left">Ticker</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Price</th>
                      <th className="px-3 py-2 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="border-t border-gray-800">
                        <td className="px-3 py-2 text-gray-300">{new Date(tx.timestamp).toLocaleDateString()}</td>
                        <td className={`px-3 py-2 font-semibold ${tx.type === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>{tx.type}</td>
                        <td className="px-3 py-2 text-white">{tx.ticker}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-300">{tx.quantity}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-300">{formatUSD(tx.priceUSD)}</td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => removeTransaction(tx.id)} className="text-gray-500 hover:text-[#FF3B30]">×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#1C1C1E] border border-gray-800 rounded-xl shadow-premium mt-6">
          <div className="p-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Add Position</h2>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-10">
              <label className="block text-xs text-gray-500 mb-2">Assets</label>
              {availableTickers.length === 0 ? (
                <div className="text-sm text-gray-400 bg-[#2C2C2E] border border-gray-700 rounded-lg px-3 py-2.5">
                  All supported assets are already in your portfolio.
                </div>
              ) : (
                <div className="bg-[#17181D] border border-gray-700 rounded-lg px-3 py-3 max-h-40 overflow-y-auto">
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    {availableTickers.map((ticker) => (
                      <label key={ticker} className="inline-flex items-center gap-2 cursor-pointer text-sm text-gray-300">
                        <input
                          type="checkbox"
                          checked={selectedAssetsToAdd.includes(ticker)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAssetsToAdd((prev) => [...prev, ticker]);
                            } else {
                              setSelectedAssetsToAdd((prev) => prev.filter((t) => t !== ticker));
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-[#0A84FF] focus:ring-[#0A84FF] focus:ring-offset-0"
                        />
                        <span>
                          <span className="font-semibold text-white">{ticker}</span>
                          <span className="text-gray-500"> - {TICKER_NAMES[ticker as keyof typeof TICKER_NAMES] || ticker}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button
                onClick={addSelectedHoldings}
                disabled={selectedAssetsToAdd.length === 0}
                className="flex-1 px-4 py-2.5 bg-[#0A84FF] text-white font-semibold rounded-lg hover:bg-[#0066CC] disabled:opacity-50 transition-colors"
              >
                Add Selected
              </button>
            </div>
          </div>
        </div>

        {message && (
          <div className={`mt-4 p-3 rounded text-center ${message?.type === 'success' ? 'bg-green-900/50 text-green-200 border border-green-800' : 'bg-red-900/50 text-red-200 border border-red-800'}`}>
            {message?.text}
          </div>
        )}
      </div>
    </div>
  );
}

export default Portfolio;
