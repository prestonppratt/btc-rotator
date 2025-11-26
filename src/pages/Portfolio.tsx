import { useEffect, useState, useRef, useCallback } from 'react';
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

  // Fetch Bitcoin price
  const updateBitcoinPrice = async () => {
    const btcPrice = await fetchBitcoinPrice();
    if (btcPrice > 0) {
      setBitcoinPrice(btcPrice);
    }
  };

  // Convert USD price to Bitcoin price
  const usdToBtc = (usdPrice: number): number => {
    if (bitcoinPrice > 0) {
      return usdPrice / bitcoinPrice;
    }
    return 0;
  };

  // Fetch price for a single ticker and update holdings
  const updatePriceForTicker = async (ticker: string) => {
    setHoldings(prev => prev.map(h =>
      h.ticker === ticker ? { ...h, isLoadingPrice: true } : h
    ));

    const price = await fetchPrice(ticker);

    setHoldings(prev => prev.map(h =>
      h.ticker === ticker ? { ...h, pricePerShare: price, isLoadingPrice: false } : h
    ));
  };

  // Fetch prices for all holdings
  const updateAllPrices = useCallback(async (currentHoldings: Holding[]) => {
    if (currentHoldings.length === 0) return;

    // Note: We don't set isLoadingPrice=true here to avoid flashing UI on background updates

    // Fetch all prices in parallel
    const pricePromises = currentHoldings.map(async (h) => {
      const price = await fetchPrice(h.ticker);
      return { ticker: h.ticker, price };
    });

    const results = await Promise.all(pricePromises);

    // Update all prices
    setHoldings(prev => prev.map(h => {
      const result = results.find(r => r.ticker === h.ticker);
      // Only update price if we got a valid non-zero price, otherwise keep existing
      return result && result.price > 0
        ? { ...h, pricePerShare: result.price, isLoadingPrice: false }
        : { ...h, isLoadingPrice: false };
    }));
  }, []);



  // Fetch Bitcoin price on mount and periodically
  useEffect(() => {
    updateBitcoinPrice();
    const btcInterval = setInterval(() => {
      updateBitcoinPrice();
    }, 30000); // Update Bitcoin price every 30 seconds

    return () => clearInterval(btcInterval);
  }, []);

  // Real-time price updates - fetch every 30 seconds
  useEffect(() => {
    if (holdings.length === 0) return;

    // Initial fetch
    updateAllPrices(holdings);

    // Set up interval for updates (every 30 seconds)
    const interval = setInterval(() => {
      updateAllPrices(holdingsRef.current);
    }, 30000);

    return () => clearInterval(interval);
  }, [holdings.length, updateAllPrices]); // Re-run when holdings count changes

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

    // Fetch price immediately for the new holding
    updatePriceForTicker(ticker);
  };

  const removeHolding = (ticker: string) => {
    setHoldings(holdings.filter((h) => h.ticker !== ticker));
    setAvailableTickers((prev) => [...prev, ticker].sort());
  };

  const updateShares = (ticker: string, shares: number) => {
    setHoldings(holdings.map((h) => (h.ticker === ticker ? { ...h, shares } : h)));
  };

  // Calculate total value in Bitcoin
  const totalValue = holdings.reduce((sum, h) => {
    const usdValue = h.pricePerShare * h.shares;
    return sum + usdToBtc(usdValue);
  }, 0);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const user = await getCurrentUser();

      // Save to backend
      await client.models.User.update({
        id: user.userId,
        portfolio: JSON.stringify(holdings)
      });

      // Also save to local storage as backup/cache
      const email = ((user as any)?.attributes?.email as string) || 'guest';
      localStorage.setItem(`portfolio_${email}`, JSON.stringify(holdings));

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
        // Fetch current prices for loaded holdings
        setTimeout(() => {
          migrated.forEach(h => updatePriceForTicker(h.ticker));
        }, 100);
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
        <h1 className="text-3xl font-bold mb-8 text-center text-primary">Stack</h1>

        {/* Action Bar: Add Position & Buttons */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 glass-panel p-4 rounded-lg">
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
              className="bg-white text-gray-900 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-primary min-w-[200px]"
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
              className="flex-1 md:flex-none px-6 py-2 bg-white/10 text-white font-semibold rounded hover:bg-white/20 transition-colors"
            >
              Load Stack
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 md:flex-none px-6 py-2 bg-primary text-white font-bold rounded hover:bg-primary-dark disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {isSaving ? <LoadingSpinner size="sm" /> : 'Save Stack'}
            </button>
          </div>
        </div>

        {/* Holdings Table */}
        <div className="glass-panel rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-white/5 text-left text-xs uppercase text-gray-400">
                <th className="px-4 py-3 font-semibold">Asset</th>
                <th className="px-4 py-3 font-semibold text-right">Quantity</th>
                <th className="px-4 py-3 font-semibold text-right">Price ({denomination === 'Sats' ? 'Sats' : '₿'})</th>
                <th className="px-4 py-3 font-semibold text-right">Value ({denomination === 'Sats' ? 'Sats' : '₿'})</th>
                <th className="px-4 py-3 font-semibold text-center w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {holdings.length > 0 ? (
                holdings.map((h) => {
                  const usdPositionValue = h.pricePerShare * h.shares;
                  const btcPositionValue = usdToBtc(usdPositionValue);
                  const btcPricePerShare = usdToBtc(h.pricePerShare);

                  return (
                    <tr key={h.ticker} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-4">
                        <div className="font-medium text-white">
                          {(TICKER_NAMES as Record<string, string>)[h.ticker] || h.ticker}
                        </div>
                        <div className="text-xs text-gray-500">{h.ticker}</div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={h.shares || ''}
                          onChange={(e) => updateShares(h.ticker, parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="w-24 text-right"
                        />
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-gray-300">
                        {h.isLoadingPrice ? (
                          <span className="text-gray-500 text-xs">Loading...</span>
                        ) : btcPricePerShare > 0 ? (
                          <span>
                            {denomination === 'Sats'
                              ? `${(btcPricePerShare * 100000000).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                              : `₿${formatBitcoin(btcPricePerShare)}`
                            }
                          </span>
                        ) : (
                          <span className="text-yellow-500 text-xs">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right font-mono font-medium text-primary">
                        {denomination === 'Sats'
                          ? `${(btcPositionValue * 100000000).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                          : `₿${formatBitcoin(btcPositionValue)}`
                        }
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => removeHolding(h.ticker)}
                          className="text-gray-500 hover:text-red-500 transition-colors p-1 rounded hover:bg-white/10"
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
            {holdings.length > 0 && (
              <tfoot className="bg-white/5 border-t border-gray-700/50">
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-right font-bold text-gray-300">
                    Total Stack
                  </td>
                  <td className="px-4 py-4 text-right font-mono font-bold text-xl text-primary">
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
