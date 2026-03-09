import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { SUPPORTED_TICKERS, TICKER_NAMES } from '../constants/tickers';
import LoadingSpinner from '../components/LoadingSpinner';
import { getCurrentUser } from 'aws-amplify/auth';
import { TrashIcon } from '@heroicons/react/24/outline';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { useDenomination } from '../contexts/DenominationContext';

const client = generateClient<Schema>();

interface Holding {
  ticker: string;
  shares: number;
  pricePerShare: number;
  isLoadingPrice?: boolean;
}

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
  const [availableTickers, setAvailableTickers] = useState<string[]>([...SUPPORTED_TICKERS]);
  const [selectedTicker, setSelectedTicker] = useState<string>('');
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [bitcoinPrice, setBitcoinPrice] = useState<number>(0);
  const holdingsRef = useRef<Holding[]>([]);

  // Keep ref in sync with state
  useEffect(() => {
    holdingsRef.current = holdings;
  }, [holdings]);

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
  const displayHoldings = useMemo(() => {
    return holdings.map((h, index) => {
      const query = priceQueries[index];
      const livePrice = query?.data;
      const isLoading = query?.isLoading;

      // Use live price if available, otherwise fallback to stored price
      const priceToUse = (livePrice && livePrice > 0) ? livePrice : h.pricePerShare;

      return {
        ...h,
        pricePerShare: priceToUse,
        isLoadingPrice: isLoading && !priceToUse, // Only show loading if we have no price at all
      };
    });
  }, [holdings, priceQueries]);

  // Convert USD price to Bitcoin price
  const usdToBtc = (usdPrice: number): number => {
    if (bitcoinPrice > 0) {
      return usdPrice / bitcoinPrice;
    }
    return 0;
  };

  // Functions to add and remove holdings
  const addHolding = async (ticker: string) => {
    if (!ticker || holdings.find((h) => h.ticker === ticker)) {
      setSelectedTicker('');
      return;
    }
    const newHolding: Holding = { ticker, shares: 0, pricePerShare: 0, isLoadingPrice: true };
    setHoldings([...holdings, newHolding]);
    setAvailableTickers((prev) => prev.filter((t) => t !== ticker));
    setSelectedTicker('');
  };

  const removeHolding = (ticker: string) => {
    setHoldings(holdings.filter((h) => h.ticker !== ticker));
    setAvailableTickers((prev) => [...prev, ticker].sort());
  };

  const updateShares = (ticker: string, shares: number) => {
    setHoldings(holdings.map((h) => (h.ticker === ticker ? { ...h, shares } : h)));
  };

  // Calculate total value in Bitcoin using displayHoldings
  const totalValue = displayHoldings.reduce((sum, h) => {
    const usdValue = h.pricePerShare * h.shares;
    return sum + usdToBtc(usdValue);
  }, 0);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const user = await getCurrentUser();
      const email = user.signInDetails?.loginId || ((user as any)?.attributes?.email as string) || 'guest';

      // Use displayHoldings to save the latest prices
      const holdingsToSave = displayHoldings.map(({ isLoadingPrice, ...h }) => h);

      // Check if user exists
      const userData = await client.models.User.get({ id: user.userId });

      if (userData.data) {
        // Update existing user
        await client.models.User.update({
          id: user.userId,
          portfolio: JSON.stringify(holdingsToSave)
        });
      } else {
        // Create new user record
        await client.models.User.create({
          id: user.userId,
          email: email,
          signupDate: new Date().toISOString(),
          notificationFreq: 'weekly', // Default
          portfolio: JSON.stringify(holdingsToSave),
          isPaid: false
        });
      }

      // Also save to local storage as backup/cache
      localStorage.setItem(`portfolio_${email}`, JSON.stringify(holdingsToSave));

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

      if (userData.data?.portfolio) {
        // Backend has data
        if (typeof userData.data.portfolio === 'string') {
          loadedHoldings = JSON.parse(userData.data.portfolio);
        } else {
          loadedHoldings = userData.data.portfolio as unknown as Holding[];
        }
      } else {
        // Fallback to local storage if backend is empty
        const email = ((user as any)?.attributes?.email as string) || 'guest';
        const saved = localStorage.getItem(`portfolio_${email}`);
        if (saved) {
          loadedHoldings = JSON.parse(saved);
        }
      }

      if (loadedHoldings) {
        // Migrate old format to new format
        const migrated = loadedHoldings.map(h => ({
          ...h,
          pricePerShare: (h as any).pricePerShare ?? 0,
          isLoadingPrice: false
        }));
        setHoldings(migrated);
        // Update available tickers
        setAvailableTickers(prev => {
          const used = migrated.map(h => h.ticker);
          return SUPPORTED_TICKERS.filter(t => !used.includes(t));
        });
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
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center text-white tracking-tight">Stack</h1>

        {/* Action Bar: Add Position & Buttons */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 bg-[#1C1C1E] border border-gray-800 p-4 rounded-xl shadow-premium">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <label htmlFor="position-select" className="text-sm font-medium text-gray-300 whitespace-nowrap">
              Add Position:
            </label>
            <select
              id="position-select"
              value={selectedTicker}
              onChange={(e) => {
                const ticker = e.target.value;
                if (ticker) addHolding(ticker);
              }}
              className="bg-[#2C2C2E] text-white border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:border-[#0A84FF] focus:ring-1 focus:ring-[#0A84FF] min-w-[200px]"
            >
              <option value="">Select Asset</option>
              {availableTickers.map((t) => (
                <option key={t} value={t}>
                  {(TICKER_NAMES as Record<string, string>)[t] || t}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <button
              onClick={loadPortfolio}
              className="flex-1 md:flex-none px-6 py-2 bg-[#2C2C2E] text-white font-medium rounded-lg hover:bg-[#3A3A3C] transition-colors border border-gray-700"
            >
              Load Stack
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 md:flex-none px-6 py-2 bg-[#0A84FF] text-white font-medium rounded-lg hover:bg-[#0066CC] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {isSaving ? <LoadingSpinner size="sm" /> : 'Save Stack'}
            </button>
          </div>
        </div>

        {/* Holdings List - Responsive Views */}
        <div className="bg-[#1C1C1E] border border-gray-800 rounded-xl overflow-hidden shadow-premium">
          {/* Desktop Table View */}
          <table className="w-full hidden md:table">
            <thead>
              <tr className="bg-[#2C2C2E] text-left text-xs uppercase tracking-wider text-gray-400">
                <th className="px-6 py-4 font-medium">Asset</th>
                <th className="px-6 py-4 font-medium text-right">Quantity</th>
                <th className="px-6 py-4 font-medium text-right">Price ({denomination === 'Sats' ? 'Sats' : '₿'})</th>
                <th className="px-6 py-4 font-medium text-right">Value ({denomination === 'Sats' ? 'Sats' : '₿'})</th>
                <th className="px-6 py-4 font-medium text-center w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {displayHoldings.length > 0 ? (
                displayHoldings.map((h) => {
                  const usdPositionValue = h.pricePerShare * h.shares;
                  const btcPositionValue = usdToBtc(usdPositionValue);
                  const btcPricePerShare = usdToBtc(h.pricePerShare);

                  return (
                    <tr key={h.ticker} className="hover:bg-[#2C2C2E]/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">
                          {(TICKER_NAMES as Record<string, string>)[h.ticker] || h.ticker}
                        </div>
                        <div className="text-xs text-gray-500">{h.ticker}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={h.shares || ''}
                          onChange={(e) => updateShares(h.ticker, parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="w-24 text-right bg-[#2C2C2E] border border-gray-700 rounded-md px-2 py-1.5 focus:border-[#0A84FF] focus:ring-1 focus:ring-[#0A84FF] focus:outline-none text-white appearance-none"
                        />
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-gray-300">
                        {h.isLoadingPrice ? (
                          <span className="text-gray-500 text-xs font-sans">Loading...</span>
                        ) : btcPricePerShare > 0 ? (
                          <span>
                            {denomination === 'Sats'
                              ? `${(btcPricePerShare * 100000000).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                              : `₿${formatBitcoin(btcPricePerShare)}`
                            }
                          </span>
                        ) : (
                          <span className="text-yellow-500 text-xs font-sans">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-medium text-white">
                        {denomination === 'Sats'
                          ? `${(btcPositionValue * 100000000).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                          : `₿${formatBitcoin(btcPositionValue)}`
                        }
                      </td>
                      <td className="px-6 py-4 text-center">
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
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No positions added yet. Use the menu above to add assets.
                  </td>
                </tr>
              )}
            </tbody>
            {displayHoldings.length > 0 && (
              <tfoot className="bg-[#1C1C1E] border-t border-gray-800">
                <tr>
                  <td colSpan={3} className="px-6 py-5 text-right font-medium text-gray-400">
                    Total Stack
                  </td>
                  <td className="px-6 py-5 text-right font-mono font-semibold text-xl text-white">
                    {denomination === 'Sats'
                      ? `${(totalValue * 100000000).toLocaleString(undefined, { maximumFractionDigits: 0 })} Sats`
                      : `₿${formatBitcoin(totalValue)}`
                    }
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4 p-4">
            {displayHoldings.length > 0 ? (
              displayHoldings.map((h) => {
                const usdPositionValue = h.pricePerShare * h.shares;
                const btcPositionValue = usdToBtc(usdPositionValue);
                const btcPricePerShare = usdToBtc(h.pricePerShare);

                return (
                  <div key={h.ticker} className="bg-[#1C1C1E] rounded-xl p-5 border border-gray-800 shadow-sm">
                    <div className="flex justify-between items-start mb-5">
                      <div>
                        <div className="font-semibold text-lg text-white">
                          {(TICKER_NAMES as Record<string, string>)[h.ticker] || h.ticker}
                        </div>
                        <div className="text-sm text-gray-500 font-medium">{h.ticker}</div>
                      </div>
                      <button
                        onClick={() => removeHolding(h.ticker)}
                        className="text-gray-500 hover:text-[#FF3B30] p-2 -mr-2 rounded-md hover:bg-[#FF3B30]/10 transition-colors"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-gray-400">Quantity</label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={h.shares || ''}
                          onChange={(e) => updateShares(h.ticker, parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="w-32 text-right bg-[#2C2C2E] border border-gray-700 rounded-md px-3 py-2 focus:border-[#0A84FF] focus:ring-1 focus:ring-[#0A84FF] focus:outline-none text-white appearance-none"
                        />
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-400">Price ({denomination === 'Sats' ? 'Sats' : '₿'})</span>
                        <span className="font-mono text-gray-300">
                          {h.isLoadingPrice ? (
                            <span className="text-gray-500 text-xs font-sans">Loading...</span>
                          ) : btcPricePerShare > 0 ? (
                            <span>
                              {denomination === 'Sats'
                                ? `${(btcPricePerShare * 100000000).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                                : `₿${formatBitcoin(btcPricePerShare)}`
                              }
                            </span>
                          ) : (
                            <span className="text-yellow-500 text-xs font-sans">N/A</span>
                          )}
                        </span>
                      </div>

                      <div className="flex justify-between items-center pt-3 border-t border-gray-800 mt-2">
                        <span className="text-sm font-medium text-gray-400">Value</span>
                        <span className="font-mono font-semibold text-lg text-white">
                          {denomination === 'Sats'
                            ? `${(btcPositionValue * 100000000).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                            : `₿${formatBitcoin(btcPositionValue)}`
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-500">
                No positions added yet. Use the menu above to add assets.
              </div>
            )}

            {/* Mobile Total Footer */}
            {displayHoldings.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-800">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-400">Total Stack</span>
                  <span className="font-mono font-semibold text-2xl text-white">
                    {denomination === 'Sats'
                      ? `${(totalValue * 100000000).toLocaleString(undefined, { maximumFractionDigits: 0 })} Sats`
                      : `₿${formatBitcoin(totalValue)}`
                    }
                  </span>
                </div>
              </div>
            )}
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
