import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchBacktestData, type BacktestDataPoint } from '../services/backtestService';
import { fetchRotationSignal, type RotationSignal } from '../services/rotatorService';
import { fetchHistoricalPricesFromBackend, triggerFetchHistoricalPrices } from '../services/historicalPriceService';
import LoadingSpinner from './LoadingSpinner';
import { getCurrentUser } from 'aws-amplify/auth';
import { TICKER_NAMES, SUPPORTED_TICKERS } from '../constants/tickers';
import { useDenomination } from '../contexts/DenominationContext';


interface PortfolioHolding {
  ticker: string;
  shares: number;
  pricePerShare: number;
}

type Timeframe = '1h' | '1d' | '1w' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y';

function Dashboard() {
  const { denomination } = useDenomination();
  const [signal, setSignal] = useState<RotationSignal | null>(null);
  const previousSignalRef = useRef<RotationSignal | null>(null);
  const confettiTriggered = useRef(false);
  const [portfolioHoldings, setPortfolioHoldings] = useState<PortfolioHolding[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('1d');
  const [portfolioChartData, setPortfolioChartData] = useState<any[]>([]);
  const [isLoadingPortfolioChart, setIsLoadingPortfolioChart] = useState(false);
  const [bitcoinPrice, setBitcoinPrice] = useState<number>(0);
  const [allAssetsHistoricalData, setAllAssetsHistoricalData] = useState<Map<string, Array<{ date: string; timestamp: number; priceUSD: number; priceBTC: number }>>>(new Map());


  const [isLoadingAllAssetsData, setIsLoadingAllAssetsData] = useState(false);
  const [isPopulatingBackend, setIsPopulatingBackend] = useState(false);
  const [backendPopulateStatus, setBackendPopulateStatus] = useState<string | null>(null);
  const [selectedAllAssetsTimeframe, setSelectedAllAssetsTimeframe] = useState<'1mo' | '3mo' | '6mo' | '1y'>('6mo');
  const [selectedAssetsToDisplay, setSelectedAssetsToDisplay] = useState<string[]>(
    SUPPORTED_TICKERS.filter(t => t !== 'BTC-USD')
  );
  const [selectedUSDAssetsTimeframe, setSelectedUSDAssetsTimeframe] = useState<'1mo' | '3mo' | '6mo' | '1y'>('6mo');
  const [selectedUSDAssetsToDisplay, setSelectedUSDAssetsToDisplay] = useState<string[]>([...SUPPORTED_TICKERS]);




  // Fetch backtest data
  const { data: backtestResponse, isLoading: backtestLoading } = useQuery({
    queryKey: ['backtest'],
    queryFn: fetchBacktestData,
    refetchInterval: 300000, // Refetch every 5 minutes
  });

  const backtestData = backtestResponse?.results || [];

  // Fetch current rotation signal
  const { data: rotationData, isLoading: rotationLoading } = useQuery({
    queryKey: ['rotation'],
    queryFn: fetchRotationSignal,
    refetchInterval: 60000, // Refetch every minute
  });

  // Update signal and trigger confetti
  useEffect(() => {
    if (rotationData) {
      const newSignal: RotationSignal = {
        shouldRotate: rotationData.shouldRotate || false,
        currentPosition: rotationData.currentPosition || null,
        newTopTicker: rotationData.newTopTicker || 'N/A',
        newTopScore: rotationData.newTopScore || 0,
        scoreGap: rotationData.scoreGap || 0,
        message: rotationData.message || 'HOLD – no new signal',
        expectedAlpha: rotationData.expectedAlpha || 0,
      };

      // Check if this is a new rotation signal
      const previousSignal = previousSignalRef.current;
      const isNewSignal = newSignal.shouldRotate &&
        (!previousSignal || !previousSignal.shouldRotate ||
          previousSignal.newTopTicker !== newSignal.newTopTicker);

      setSignal(newSignal);

      // Trigger confetti on new signal
      if (isNewSignal && !confettiTriggered.current) {
        confettiTriggered.current = true;
        triggerConfetti();

        // Reset after 5 seconds
        setTimeout(() => {
          confettiTriggered.current = false;
        }, 5000);
      }

      previousSignalRef.current = newSignal;
    }
  }, [rotationData]);

  const triggerConfetti = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function () {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  };

  // Calculate alpha from backtest data
  const calculateAlpha = (): number => {
    if (!backtestData || backtestData.length === 0) return 0;
    const latest = backtestData[backtestData.length - 1];
    if (!latest || !latest.rotatorValue || !latest.btcValue) return 0;

    const initialValue = backtestData[0]?.rotatorValue || 10000;
    const rotatorReturn = ((latest.rotatorValue - initialValue) / initialValue) * 100;
    const btcReturn = ((latest.btcValue - initialValue) / initialValue) * 100;

    return rotatorReturn - btcReturn;
  };

  const alpha = calculateAlpha();
  const [selectedPerformanceTimeframe, setSelectedPerformanceTimeframe] = useState<'1mo' | '3mo' | '6mo' | '1y' | 'ALL'>('ALL');

  const chartData = backtestData?.map((point: BacktestDataPoint) => ({
    date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    rawDate: new Date(point.date),
    'Rotator Strategy': point.rotatorValue,
    'Hold BTC': point.btcValue,
  })) || [];

  const filteredChartData = chartData.filter(point => {
    if (selectedPerformanceTimeframe === 'ALL') return true;

    const now = new Date();
    const pointDate = point.rawDate;
    const diffTime = Math.abs(now.getTime() - pointDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    switch (selectedPerformanceTimeframe) {
      case '1mo': return diffDays <= 30;
      case '3mo': return diffDays <= 90;
      case '6mo': return diffDays <= 180;
      case '1y': return diffDays <= 365;
      default: return true;
    }
  });

  // Fetch Bitcoin price
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

  // Load portfolio holdings from localStorage
  const loadPortfolio = async () => {
    try {
      const user = await getCurrentUser();
      const email = ((user as any)?.attributes?.email as string) || 'guest';
      const saved = localStorage.getItem(`portfolio_${email}`);
      console.log('Loading portfolio for:', email, 'Data:', saved);
      if (saved) {
        const loaded = JSON.parse(saved) as PortfolioHolding[];
        console.log('Loaded portfolio holdings:', loaded);
        // Filter out any holdings with 0 shares (they shouldn't be displayed)
        const validHoldings = loaded.filter(h => h.shares > 0);
        setPortfolioHoldings(validHoldings);
      } else {
        console.log('No portfolio data found');
        setPortfolioHoldings([]);
      }
    } catch (e) {
      console.error('Error loading portfolio', e);
      setPortfolioHoldings([]);
    }
  };

  useEffect(() => {
    loadPortfolio();

    // Listen for storage changes (when portfolio is updated on Portfolio page)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('portfolio_')) {
        console.log('Portfolio storage changed, reloading...');
        loadPortfolio();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom event (for same-tab updates)
    const handleCustomStorageChange = () => {
      console.log('Portfolio updated via custom event, reloading...');
      loadPortfolio();
    };

    window.addEventListener('portfolioUpdated', handleCustomStorageChange);

    // Poll for changes when page becomes visible (fallback)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadPortfolio();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Also reload when component mounts/focuses (in case user navigated from Portfolio page)
    const handleFocus = () => {
      loadPortfolio();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('portfolioUpdated', handleCustomStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Fetch Bitcoin price on mount
  useEffect(() => {
    fetchBitcoinPrice().then(setBitcoinPrice);
    const interval = setInterval(() => {
      fetchBitcoinPrice().then(setBitcoinPrice);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch historical price data for portfolio positions from backend with fallback to direct API
  const fetchHistoricalPrices = async (ticker: string, timeframe: Timeframe): Promise<{ timestamp: number; price: number; priceBTC: number }[]> => {
    const timeframeMap: Record<Timeframe, { interval: string; range: string; days: number }> = {
      '1h': { interval: '1m', range: '1d', days: 1 },
      '1d': { interval: '5m', range: '1d', days: 1 },
      '1w': { interval: '1h', range: '5d', days: 7 },
      '1mo': { interval: '1d', range: '1mo', days: 30 },
      '3mo': { interval: '1d', range: '3mo', days: 90 },
      '6mo': { interval: '1d', range: '6mo', days: 180 },
      '1y': { interval: '1wk', range: '1y', days: 365 },
      '2y': { interval: '1wk', range: '2y', days: 730 },
      '5y': { interval: '1mo', range: '5y', days: 1825 },
    };

    const { interval, range, days } = timeframeMap[timeframe];
    const endTimestamp = Date.now();
    const startTimestamp = endTimestamp - (days * 24 * 60 * 60 * 1000);

    // ALWAYS try backend first - this is much faster and more reliable
    try {
      const prices = await fetchHistoricalPricesFromBackend(ticker, startTimestamp, endTimestamp);

      if (prices.length > 0) {
        console.log(`✓ Using backend data for ${ticker}: ${prices.length} prices`);
        return prices.map(p => ({
          timestamp: p.timestamp,
          price: p.priceUSD,
          priceBTC: p.priceBTC,
        }));
      } else {
        console.log(`⚠ No backend data for ${ticker}, will use API fallback`);
      }
    } catch (e) {
      console.warn(`Backend fetch failed for ${ticker}, falling back to direct API:`, e);
    }

    // Fallback to direct API fetch if backend has no data
    console.log(`Fetching ${ticker} directly from API (backend may not have data yet)`);
    try {
      let historicalData: Array<{ timestamp: number; price: number }> = [];

      // For Bitcoin, use CoinGecko
      if (ticker === 'BTC-USD') {
        const response = await fetch(`https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`);
        const data = await response.json();
        historicalData = data.prices?.map(([timestamp, price]: [number, number]) => ({ timestamp, price })) || [];
      } else {
        // For stocks, use Yahoo Finance
        try {
          const response = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${interval}&range=${range}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            const result = data?.chart?.result?.[0];
            if (result?.timestamp && result?.indicators?.quote?.[0]?.close) {
              const timestamps = result.timestamp;
              const closes = result.indicators.quote[0].close;
              historicalData = timestamps
                .map((ts: number, i: number) => ({
                  timestamp: ts * 1000,
                  price: closes[i] || 0,
                }))
                .filter((d: { price: number }) => d.price > 0);
            } else {
              console.warn(`Yahoo Finance: No data in response for ${ticker}`, data);
            }
          } else {
            console.warn(`Yahoo Finance API error for ${ticker}: ${response.status} ${response.statusText}`);
          }
        } catch (fetchError) {
          console.error(`Error fetching from Yahoo Finance for ${ticker}:`, fetchError);
        }
      }

      if (historicalData.length === 0) {
        return [];
      }

      // Fetch historical Bitcoin prices for accurate conversion
      let btcHistorical: Array<{ timestamp: number; price: number }> = [];
      try {
        const btcResponse = await fetch(`https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`);
        const btcData = await btcResponse.json();
        btcHistorical = btcData.prices?.map(([timestamp, price]: [number, number]) => ({ timestamp, price })) || [];
      } catch (e) {
        console.error('Error fetching BTC historical prices:', e);
      }

      // Create a map for quick BTC price lookup
      const btcPriceMap = new Map<number, number>();
      btcHistorical.forEach(({ timestamp, price }) => {
        btcPriceMap.set(timestamp, price);
      });

      // Convert to BTC-denominated prices using historical BTC prices
      return historicalData.map(({ timestamp, price }) => {
        // Find closest BTC price
        let btcPrice = 0;
        if (btcPriceMap.has(timestamp)) {
          btcPrice = btcPriceMap.get(timestamp)!;
        } else {
          // Find closest timestamp
          let closestTimestamp = 0;
          let minDiff = Infinity;
          const maxDiff = days <= 1 ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

          for (const [btcTs, btcP] of btcPriceMap.entries()) {
            const diff = Math.abs(btcTs - timestamp);
            if (diff < minDiff && diff <= maxDiff) {
              minDiff = diff;
              closestTimestamp = btcTs;
            }
          }

          if (closestTimestamp > 0) {
            btcPrice = btcPriceMap.get(closestTimestamp)!;
          } else if (bitcoinPrice > 0) {
            // Fallback to current price if no historical match
            btcPrice = bitcoinPrice;
          }
        }

        return {
          timestamp,
          price,
          priceBTC: btcPrice > 0 ? price / btcPrice : 0,
        };
      });
    } catch (e) {
      console.error(`Error fetching historical data for ${ticker} from API`, e);
      return [];
    }
  };

  // Fetch historical data for each portfolio holding using useQueries
  // This ensures data is cached and not re-fetched on every render or BTC price update
  const portfolioQueries = useQueries({
    queries: portfolioHoldings.map(holding => ({
      queryKey: ['historicalPrice', holding.ticker, selectedTimeframe],
      queryFn: () => fetchHistoricalPrices(holding.ticker, selectedTimeframe),
      staleTime: 1000 * 60 * 5, // Cache for 5 minutes
      refetchOnWindowFocus: false,
    }))
  });

  // Calculate portfolio chart data when queries or BTC price changes
  useEffect(() => {
    // Check if any query is loading
    const isLoading = portfolioQueries.some(q => q.isLoading);
    setIsLoadingPortfolioChart(isLoading);

    if (isLoading || portfolioHoldings.length === 0) {
      if (portfolioHoldings.length === 0) setPortfolioChartData([]);
      return;
    }

    // Helper to find BTC price at exact timestamp or closest match (fallback)
    // We need BTC history for this. We can fetch it as a separate query or just fetch it here if not cached.
    // Ideally, we should have a useQuery for BTC history too.
    // For now, let's assume we can get it from the queries if one of them is BTC, or we might need to fetch it.
    // Actually, the previous logic fetched BTC history explicitly. Let's add a query for BTC history.
  }, [portfolioQueries, portfolioHoldings, bitcoinPrice, selectedTimeframe]);

  // We need a dedicated query for BTC history to normalize prices
  const { data: btcHistoricalData } = useQuery({
    queryKey: ['historicalPrice', 'BTC-USD', selectedTimeframe],
    queryFn: () => fetchHistoricalPrices('BTC-USD', selectedTimeframe),
    staleTime: 1000 * 60 * 5,
  });

  // Memoize the chart data calculation
  const calculatedChartData = useMemo(() => {
    if (!btcHistoricalData || portfolioHoldings.length === 0) return [];

    // Check if all portfolio queries have data
    const allQueriesSuccess = portfolioQueries.every(q => q.isSuccess && q.data);
    if (!allQueriesSuccess) return [];

    console.log('Recalculating portfolio chart data...');

    // Create a sorted array of BTC prices for efficient lookup
    const sortedBtcPrices = [...btcHistoricalData].sort((a, b) => a.timestamp - b.timestamp);

    const getBtcPriceAtTime = (timestamp: number): number => {
      // Try exact match first
      const exactMatch = sortedBtcPrices.find(d => d.timestamp === timestamp);
      if (exactMatch) return exactMatch.price;

      // Find closest timestamp
      let closest = sortedBtcPrices[0];
      let minDiff = Math.abs(sortedBtcPrices[0].timestamp - timestamp);

      for (const btcPoint of sortedBtcPrices) {
        const diff = Math.abs(btcPoint.timestamp - timestamp);
        if (diff < minDiff) {
          minDiff = diff;
          closest = btcPoint;
        }
      }

      const maxDiff = selectedTimeframe === '1h' || selectedTimeframe === '1d'
        ? 60 * 60 * 1000
        : 24 * 60 * 60 * 1000;

      if (minDiff <= maxDiff) {
        return closest.price;
      }

      return bitcoinPrice; // Fallback to current price
    };

    // Collect all unique timestamps
    const allTimestamps = new Set<number>();
    const positionDataMap = new Map<string, Array<{ timestamp: number; price: number; priceBTC: number }>>();

    portfolioHoldings.forEach((holding, index) => {
      const query = portfolioQueries[index];
      if (query.data && query.data.length > 0) {
        positionDataMap.set(holding.ticker, query.data);
        query.data.forEach((d: any) => allTimestamps.add(d.timestamp));
      }
    });

    const chartDataArray = Array.from(allTimestamps)
      .sort((a, b) => a - b)
      .map((timestamp) => {
        const point: { date: string; timestamp: number;[key: string]: string | number } = {
          date: '',
          timestamp,
        };

        let totalBtcValue = 0;

        portfolioHoldings.forEach((holding) => {
          const positionData = positionDataMap.get(holding.ticker);
          if (positionData) {
            let closestData = positionData[0];
            let minDiff = Math.abs(positionData[0].timestamp - timestamp);

            for (const dataPoint of positionData) {
              const diff = Math.abs(dataPoint.timestamp - timestamp);
              if (diff < minDiff) {
                minDiff = diff;
                closestData = dataPoint;
              }
            }

            let unitPriceBtc = 0;
            if (holding.ticker === 'BTC-USD') {
              unitPriceBtc = 1;
            } else if (closestData.priceBTC > 0) {
              unitPriceBtc = closestData.priceBTC;
            }

            point[holding.ticker] = unitPriceBtc * holding.shares;

            if (unitPriceBtc > 0 && holding.shares > 0) {
              totalBtcValue += unitPriceBtc * holding.shares;
            }
          } else {
            point[holding.ticker] = 0;
          }
        });

        point['Total Stack Value'] = totalBtcValue;

        const date = new Date(timestamp);
        point.date = selectedTimeframe === '1h' || selectedTimeframe === '1d' || selectedTimeframe === '1mo'
          ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
          : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        return point;
      })
      .filter(point => {
        const hasPositionData = portfolioHoldings.some(holding => {
          const value = point[holding.ticker];
          return typeof value === 'number' && value > 0;
        });
        const hasTotalValue = (point['Total Stack Value'] as number) > 0;
        return hasPositionData || hasTotalValue;
      });

    return chartDataArray;
  }, [portfolioQueries, portfolioHoldings, btcHistoricalData, bitcoinPrice, selectedTimeframe]);

  // Update state when calculated data changes
  useEffect(() => {
    setPortfolioChartData(calculatedChartData);
  }, [calculatedChartData]);

  // Fetch historical data for all assets (backend cached) using React Query
  const { data: allAssetsDataMap, isLoading: isAllAssetsLoading } = useQuery({
    queryKey: ['allAssetsHistoricalData'],
    queryFn: async () => {
      console.log('Loading real historical data for all assets from backend...');
      const dataMap = new Map<string, Array<{ date: string; timestamp: number; priceUSD: number; priceBTC: number }>>();
      const days = 365; // 1 year
      const endTimestamp = Date.now();
      const startTimestamp = endTimestamp - (days * 24 * 60 * 60 * 1000);

      // Fetch data for all supported tickers from backend
      await Promise.all(SUPPORTED_TICKERS.map(async (ticker) => {
        try {
          const prices = await fetchHistoricalPricesFromBackend(ticker, startTimestamp, endTimestamp);

          if (prices.length > 0) {
            const formattedData = prices.map(p => ({
              date: new Date(p.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
              timestamp: p.timestamp,
              priceUSD: p.priceUSD,
              priceBTC: p.priceBTC,
            }));
            dataMap.set(ticker, formattedData);
            console.log(`✓ Loaded ${prices.length} points for ${ticker} from backend`);
          } else {
            console.warn(`⚠ No backend data for ${ticker}`);
          }
        } catch (e) {
          console.error(`Error loading ${ticker} from backend:`, e);
        }
      }));

      if (dataMap.size > 0) {
        console.log(`Successfully loaded real data for ${dataMap.size} assets from backend`);
      } else {
        console.warn('No backend data available for any assets. Backend may not be populated yet.');
      }
      return dataMap;
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
    refetchOnWindowFocus: false,
  });

  // Sync query data to state for compatibility with existing code
  useEffect(() => {
    if (allAssetsDataMap) {
      setAllAssetsHistoricalData(allAssetsDataMap);
      setIsLoadingAllAssetsData(false);
    }
  }, [allAssetsDataMap]);

  // Format Bitcoin value
  const formatBitcoin = (value: number): string => {
    if (value >= 1) {
      return value.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    } else if (value >= 0.01) {
      return value.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 });
    } else {
      return value.toLocaleString('en-US', { minimumFractionDigits: 8, maximumFractionDigits: 8 });
    }
  };

  const displayMessage = signal?.shouldRotate
    ? `SELL ${signal.currentPosition} → BUY ${signal.newTopTicker}`
    : 'HOLD – no new signal';

  return (
    <div className="space-y-6 md:space-y-8 px-4 sm:px-6 lg:px-8">
      {/* Small gray text top-right */}
      <div className="flex justify-end">
        <p className="text-xs text-gray-500">
          Entertainment only • Not advice • At your own risk
        </p>
      </div>

      {/* Huge centered neon card */}
      <div className="flex justify-center">
        <div className="w-full max-w-4xl">
          <div className="relative glass-panel border-2 sm:border-4 border-primary rounded-xl sm:rounded-2xl p-6 sm:p-8 md:p-12 shadow-2xl shadow-primary/50">
            {/* Neon glow effect */}
            <div className="absolute inset-0 bg-primary/10 rounded-xl sm:rounded-2xl blur-xl"></div>

            <div className="relative z-10 text-center">
              {rotationLoading ? (
                <div className="flex flex-col items-center gap-3 sm:gap-4">
                  <LoadingSpinner size="lg" className="border-primary border-t-primary" />
                  <div className="text-primary text-xl sm:text-2xl md:text-4xl font-bold">
                    Loading signal...
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-primary text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-bold mb-3 sm:mb-4 md:mb-6 tracking-wide break-words">
                    {displayMessage}
                  </div>
                  {signal?.shouldRotate && (
                    <div className="text-primary-dark text-sm sm:text-base md:text-lg lg:text-xl mt-3 sm:mt-4">
                      {signal.message.split('\n')[0]}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Alpha Badge */}
      {!backtestLoading && alpha !== 0 && (
        <div className="flex justify-center">
          <div className={`px-4 sm:px-6 md:px-8 py-2 sm:py-3 md:py-4 rounded-full text-lg sm:text-2xl md:text-4xl font-bold ${alpha > 0
            ? 'bg-green-500/20 text-green-400 border-2 border-green-400'
            : 'bg-red-500/20 text-red-400 border-2 border-red-400'
            }`}>
            {alpha > 0 ? '+' : ''}{alpha.toFixed(2)}% alpha
          </div>
        </div>
      )}



      {/* Recharts Line Chart */}
      <div className="glass-panel rounded-lg p-3 sm:p-4 md:p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white text-center sm:text-left">
            Performance Comparison
          </h2>
          <div className="flex flex-wrap gap-2">
            {(['1mo', '3mo', '6mo', '1y', 'ALL'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedPerformanceTimeframe(tf)}
                className={`px-3 py-1 text-sm rounded transition-colors ${selectedPerformanceTimeframe === tf
                  ? 'bg-primary text-white font-bold'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
        {backtestLoading ? (
          <div className="text-center py-8 sm:py-12 flex flex-col items-center gap-4">
            <LoadingSpinner size="lg" />
            <p className="text-gray-400 text-sm sm:text-base">Loading chart data...</p>
          </div>
        ) : filteredChartData.length === 0 ? (
          <div className="text-center py-8 sm:py-12 text-gray-400 text-sm sm:text-base">No backtest data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={300} className="sm:h-[400px]">
            <LineChart data={filteredChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="date"
                stroke="#9CA3AF"
                style={{ fontSize: '12px' }}
              />
              <YAxis
                stroke="#9CA3AF"
                style={{ fontSize: '12px' }}
                tickFormatter={(value) => `$${value.toLocaleString()}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  backdropFilter: 'blur(4px)'
                }}
                formatter={(value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              />
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
              />
              <Line
                type="monotone"
                dataKey="Rotator Strategy"
                stroke="#FF6719"
                strokeWidth={3}
                dot={false}
                name="Rotator Strategy"
              />
              <Line
                type="monotone"
                dataKey="Hold BTC"
                stroke="#3B82F6"
                strokeWidth={3}
                dot={false}
                name="Hold BTC"
              />
            </LineChart>
          </ResponsiveContainer>
        )
        }
      </div>

      {/* Portfolio Positions Chart */}
      {portfolioHoldings.length > 0 && (
        <div className="glass-panel rounded-lg p-3 sm:p-4 md:p-6 shadow-lg">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
            <div>
              <div>
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
                  Stack Positions - Value (₿)
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Showing total value in Bitcoin for each position in your stack
                </p>
                {portfolioChartData.length > 0 && (
                  <p className="text-sm text-gray-400 mt-1">
                    Total Stack Value: <span className="text-primary font-semibold">₿{formatBitcoin((portfolioChartData[portfolioChartData.length - 1]?.['Total Stack Value'] as number) || 0)}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['1h', '1d', '1w', '1mo', '3mo', '6mo', '1y', '2y', '5y'] as Timeframe[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setSelectedTimeframe(tf)}
                  className={`px-3 py-1 text-sm rounded transition-colors ${selectedTimeframe === tf
                    ? 'bg-primary text-white font-bold'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
          {isLoadingPortfolioChart ? (
            <div className="text-center py-8 sm:py-12 flex flex-col items-center gap-4">
              <LoadingSpinner size="lg" />
              <p className="text-gray-400 text-sm sm:text-base">Loading stack chart data...</p>
            </div>
          ) : portfolioChartData.length === 0 ? (
            <div className="text-center py-8 sm:py-12 text-gray-400 text-sm sm:text-base">
              {bitcoinPrice === 0
                ? 'Loading Bitcoin price...'
                : 'No chart data available for selected timeframe. Try a different timeframe or check console for errors.'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={portfolioChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="date"
                  stroke="#9CA3AF"
                  style={{ fontSize: '12px' }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  stroke="#9CA3AF"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(value) => {
                    if (value === 0) return '₿0';
                    return `₿${formatBitcoin(value)}`;
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#fff',
                    backdropFilter: 'blur(4px)'
                  }}
                  formatter={(value: number, name: string) => {
                    if (typeof value === 'number' && value > 0) {
                      const displayName = name === 'Total Stack Value'
                        ? 'Total Stack Value'
                        : (TICKER_NAMES[name as keyof typeof TICKER_NAMES] || name);
                      return [`₿${formatBitcoin(value)}`, displayName];
                    }
                    return ['N/A', name];
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: '20px' }}
                />
                {/* Line for each position showing unit price in BTC */}
                {portfolioHoldings.map((holding, index) => {
                  // Generate distinct colors for each position
                  const colors = [
                    '#10B981', // green
                    '#3B82F6', // blue
                    '#F59E0B', // amber
                    '#EF4444', // red
                    '#8B5CF6', // purple
                    '#EC4899', // pink
                    '#06B6D4', // cyan
                    '#F97316', // orange
                    '#84CC16', // lime
                    '#14B8A6', // teal
                  ];
                  const color = colors[index % colors.length];

                  return (
                    <Line
                      key={holding.ticker}
                      type="monotone"
                      dataKey={holding.ticker}
                      stroke={color}
                      strokeWidth={2}
                      dot={false}
                      name={TICKER_NAMES[holding.ticker as keyof typeof TICKER_NAMES] || holding.ticker}
                      connectNulls={false}
                    />
                  );
                })}
                {/* Total Stack Value line */}
                <Line
                  type="monotone"
                  dataKey="Total Stack Value"
                  stroke="#10B981"
                  strokeWidth={3}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Total Stack Value"
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
          {backendPopulateStatus && (
            <p className={`text-xs mt-2 text-center ${backendPopulateStatus.startsWith('Success') ? 'text-green-400' : 'text-red-400'}`}>
              {backendPopulateStatus}
            </p>
          )}
        </div>
      )}


      <div className="glass-panel rounded-lg p-3 sm:p-4 md:p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
          <div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
              All Assets - Unit Price ({denomination === 'Sats' ? 'Sats' : '₿'})
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Historical price of 1 unit of each asset denominated in Bitcoin
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 items-end sm:items-center">
            <div className="flex gap-2">
              {(['1mo', '3mo', '6mo', '1y'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setSelectedAllAssetsTimeframe(tf)}
                  className={`px-3 py-1 text-sm rounded transition-colors ${selectedAllAssetsTimeframe === tf
                    ? 'bg-primary text-white font-bold'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}
                >
                  {tf}
                </button>
              ))}
            </div>
            <button
              onClick={async () => {
                setIsPopulatingBackend(true);
                setBackendPopulateStatus(null);
                try {
                  const result = await triggerFetchHistoricalPrices([...SUPPORTED_TICKERS], 365); // 1 year
                  setBackendPopulateStatus(`Success: ${result}`);
                  // Reload data after population
                  setTimeout(() => {
                    window.location.reload();
                  }, 2000);
                } catch (error: any) {
                  setBackendPopulateStatus(`Error: ${error.message}`);
                } finally {
                  setIsPopulatingBackend(false);
                }
              }}
              disabled={isPopulatingBackend}
              className="px-3 py-2 bg-primary text-white font-bold rounded hover:bg-primary-dark disabled:opacity-50 transition-colors text-sm"
            >
              {isPopulatingBackend ? 'Populating...' : 'Refresh Backend Data'}
            </button>
          </div>
        </div>

        {/* Asset Selection */}
        <div className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10">
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs text-gray-400">Select assets to display:</p>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedAssetsToDisplay(SUPPORTED_TICKERS.filter(t => t !== 'BTC-USD'))}
                className="text-xs text-primary hover:text-primary-light transition-colors"
              >
                Select All
              </button>
              <button
                onClick={() => setSelectedAssetsToDisplay([])}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {SUPPORTED_TICKERS.filter(t => t !== 'BTC-USD').map((ticker) => (
              <label key={ticker} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedAssetsToDisplay.includes(ticker)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedAssetsToDisplay([...selectedAssetsToDisplay, ticker]);
                    } else {
                      setSelectedAssetsToDisplay(selectedAssetsToDisplay.filter(t => t !== ticker));
                    }
                  }}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary focus:ring-primary focus:ring-offset-gray-900"
                />
                <span className="text-sm text-gray-300">
                  {TICKER_NAMES[ticker as keyof typeof TICKER_NAMES] || ticker}
                </span>
              </label>
            ))}
          </div>
        </div>

        {isLoadingAllAssetsData ? (
          <div className="text-center py-8 sm:py-12 flex flex-col items-center gap-4">
            <LoadingSpinner size="lg" />
            <p className="text-gray-400 text-sm sm:text-base">Loading all assets data...</p>
          </div>
        ) : allAssetsHistoricalData.size === 0 ? (
          <div className="text-center py-8 sm:py-12 text-gray-400 text-sm sm:text-base">
            No historical data available. Click "Refresh Backend Data" to populate.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(ts) => {
                  const date = new Date(ts);
                  if (selectedAllAssetsTimeframe === '1mo' || selectedAllAssetsTimeframe === '3mo') {
                    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' });
                  }
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }}
                stroke="#9CA3AF"
                style={{ fontSize: '12px' }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                stroke="#9CA3AF"
                style={{ fontSize: '12px' }}
                tickFormatter={(value) => {
                  if (value === 0) return denomination === 'Sats' ? '0' : '₿0';
                  return denomination === 'Sats'
                    ? value.toLocaleString(undefined, { maximumFractionDigits: 0 })
                    : `₿${formatBitcoin(value)}`;
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#fff',
                  backdropFilter: 'blur(4px)'
                }}
                labelFormatter={(label) => new Date(label).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                formatter={(value: number, name: string) => {
                  if (typeof value === 'number' && value > 0) {
                    const displayName = TICKER_NAMES[name as keyof typeof TICKER_NAMES] || name;
                    return [`₿${formatBitcoin(value)}`, displayName];
                  }
                  return ['N/A', name];
                }}
              />

              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              {(() => {
                // Filter data based on selected timeframe
                const cutoffDate = new Date();
                switch (selectedAllAssetsTimeframe) {
                  case '1mo':
                    cutoffDate.setMonth(cutoffDate.getMonth() - 1);
                    break;
                  case '3mo':
                    cutoffDate.setMonth(cutoffDate.getMonth() - 3);
                    break;
                  case '6mo':
                    cutoffDate.setMonth(cutoffDate.getMonth() - 6);
                    break;
                  case '1y':
                    cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
                    break;
                }
                const cutoffTimestamp = cutoffDate.getTime();

                // Merge all data into a single array for the chart
                const mergedDataMap = new Map<string, any>();

                allAssetsHistoricalData.forEach((data, ticker) => {
                  data.forEach(point => {
                    const timestamp = new Date(point.date).getTime();
                    if (timestamp >= cutoffTimestamp) {
                      const dateKey = point.date;
                      if (!mergedDataMap.has(dateKey)) {
                        mergedDataMap.set(dateKey, { date: dateKey, timestamp });
                      }
                      const existing = mergedDataMap.get(dateKey);
                      existing[ticker] = denomination === 'Sats' ? point.priceBTC * 100000000 : point.priceBTC;
                    }
                  });
                });

                const mergedData = Array.from(mergedDataMap.values())
                  .sort((a, b) => a.timestamp - b.timestamp);

                // Filter to show only selected assets (excluding BTC-USD)
                const tickersToDisplay = selectedAssetsToDisplay.filter(t => t !== 'BTC-USD');

                // If no assets selected, show a message
                if (tickersToDisplay.length === 0) {
                  return (
                    <text x="50%" y="50%" textAnchor="middle" fill="#9CA3AF" fontSize="14">
                      Select at least one asset to display
                    </text>
                  );
                }

                return tickersToDisplay.map((ticker, index) => {
                  // Generate distinct colors
                  const colors = [
                    '#3B82F6', // Blue
                    '#10B981', // Green
                    '#EF4444', // Red
                    '#8B5CF6', // Purple
                    '#F59E0B', // Amber
                    '#EC4899', // Pink
                    '#06B6D4', // Cyan
                    '#F97316', // Orange
                  ];
                  const color = colors[index % colors.length];

                  return (
                    <Line
                      key={ticker}
                      data={mergedData}
                      type="monotone"
                      dataKey={ticker}
                      stroke={color}
                      strokeWidth={2}
                      dot={false}
                      name={TICKER_NAMES[ticker as keyof typeof TICKER_NAMES] || ticker}
                      connectNulls={true}
                    />
                  );
                });
              })()}
            </LineChart>
          </ResponsiveContainer>
        )}
        {backendPopulateStatus && (
          <p className={`text-xs mt-2 text-center ${backendPopulateStatus.startsWith('Success') ? 'text-green-400' : 'text-red-400'}`}>
            {backendPopulateStatus}
          </p>
        )}
      </div>

      {/* Community Section */}
      {/* All Assets - USD Price Chart */}
      <div className="glass-panel rounded-lg p-3 sm:p-4 md:p-6 shadow-lg mt-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
          <div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
              All Assets - Unit Price ($)
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Historical price of 1 unit of each asset denominated in USD
            </p>
          </div>
          <div className="flex gap-2">
            {(['1mo', '3mo', '6mo', '1y'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedUSDAssetsTimeframe(tf)}
                className={`px-3 py-1 text-sm rounded transition-colors ${selectedUSDAssetsTimeframe === tf
                  ? 'bg-primary text-white font-bold'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* USD Asset Selection */}
        <div className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10">
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs text-gray-400">Select assets to display:</p>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedUSDAssetsToDisplay([...SUPPORTED_TICKERS])}
                className="text-xs text-primary hover:text-primary-light transition-colors"
              >
                Select All
              </button>
              <button
                onClick={() => setSelectedUSDAssetsToDisplay([])}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {SUPPORTED_TICKERS.map((ticker) => (
              <label key={ticker} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedUSDAssetsToDisplay.includes(ticker)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedUSDAssetsToDisplay([...selectedUSDAssetsToDisplay, ticker]);
                    } else {
                      setSelectedUSDAssetsToDisplay(selectedUSDAssetsToDisplay.filter(t => t !== ticker));
                    }
                  }}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary focus:ring-primary focus:ring-offset-gray-900"
                />
                <span className="text-sm text-gray-300">
                  {TICKER_NAMES[ticker as keyof typeof TICKER_NAMES] || ticker}
                </span>
              </label>
            ))}
          </div>
        </div>

        {allAssetsHistoricalData.size === 0 ? (
          <div className="text-center py-8 sm:py-12 text-gray-400 text-sm sm:text-base">
            No historical data available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(ts) => {
                  const date = new Date(ts);
                  if (selectedUSDAssetsTimeframe === '1mo' || selectedUSDAssetsTimeframe === '3mo') {
                    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' });
                  }
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }}
                stroke="#9CA3AF"
                style={{ fontSize: '12px' }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              {/* Left Y-axis for all assets except BTC */}
              <YAxis
                yAxisId="left"
                stroke="#9CA3AF"
                style={{ fontSize: '12px' }}
                tickFormatter={(value) => `$${value.toLocaleString()}`}
              />
              {/* Right Y-axis for BTC-USD */}
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#F7931A"
                style={{ fontSize: '12px' }}
                tickFormatter={(value) => `$${value.toLocaleString()}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#fff',
                  backdropFilter: 'blur(4px)'
                }}
                labelFormatter={(label) => new Date(label).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                formatter={(value: number, name: string) => {
                  if (typeof value === 'number') {
                    return [`$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, TICKER_NAMES[name as keyof typeof TICKER_NAMES] || name];
                  }
                  return ['N/A', name];
                }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              {(() => {
                // Filter data based on selected timeframe
                const cutoffDate = new Date();
                switch (selectedUSDAssetsTimeframe) {
                  case '1mo':
                    cutoffDate.setMonth(cutoffDate.getMonth() - 1);
                    break;
                  case '3mo':
                    cutoffDate.setMonth(cutoffDate.getMonth() - 3);
                    break;
                  case '6mo':
                    cutoffDate.setMonth(cutoffDate.getMonth() - 6);
                    break;
                  case '1y':
                    cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
                    break;
                }
                const cutoffTimestamp = cutoffDate.getTime();

                // Merge all data into a single array for the chart
                const mergedDataMap = new Map<string, any>();

                allAssetsHistoricalData.forEach((data, ticker) => {
                  data.forEach(point => {
                    const timestamp = new Date(point.date).getTime();
                    if (timestamp >= cutoffTimestamp) {
                      const key = point.timestamp.toString();
                      if (!mergedDataMap.has(key)) {
                        mergedDataMap.set(key, { date: point.date, timestamp: point.timestamp });
                      }
                      const existing = mergedDataMap.get(key);
                      existing[ticker] = point.priceUSD; // Use USD price instead of BTC
                    }
                  });
                });

                const mergedData = Array.from(mergedDataMap.values())
                  .sort((a, b) => a.timestamp - b.timestamp);

                // Filter to show only selected assets
                const tickersToDisplay = selectedUSDAssetsToDisplay;

                // If no assets selected, show a message
                if (tickersToDisplay.length === 0) {
                  return (
                    <text x="50%" y="50%" textAnchor="middle" fill="#9CA3AF" fontSize="14">
                      Select at least one asset to display
                    </text>
                  );
                }

                return tickersToDisplay.map((ticker, index) => {
                  // Generate distinct colors
                  const colors = [
                    '#F7931A', // BTC (Orange)
                    '#3B82F6', // Blue
                    '#10B981', // Green
                    '#EF4444', // Red
                    '#8B5CF6', // Purple
                    '#F59E0B', // Amber
                    '#EC4899', // Pink
                    '#06B6D4', // Cyan
                    '#F97316', // Orange
                    '#14B8A6', // Teal
                    '#A855F7', // Violet
                    '#F43F5E', // Rose
                    '#84CC16', // Lime
                    '#06B6D4', // Sky
                    '#F59E0B', // Yellow
                    '#EC4899', // Fuchsia
                  ];
                  const color = ticker === 'BTC-USD' ? '#F7931A' : colors[(index + 1) % colors.length];

                  return (
                    <Line
                      key={ticker}
                      data={mergedData}
                      type="monotone"
                      dataKey={ticker}
                      stroke={color}
                      strokeWidth={ticker === 'BTC-USD' ? 3 : 2}
                      dot={false}
                      name={TICKER_NAMES[ticker as keyof typeof TICKER_NAMES] || ticker}
                      connectNulls={true}
                      yAxisId={ticker === 'BTC-USD' ? 'right' : 'left'}
                    />
                  );
                });
              })()}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="glass-panel rounded-lg p-6 shadow-lg border border-gray-700">
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-primary mb-3">
            Join the Community
          </h2>
          <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
            Get real-time rotation signals, weekly breakdowns, premium insights, and connect with peers who rotate for alpha.
          </p>
          <a
            href="https://www.peerrotator.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-primary text-white font-bold py-3 px-8 rounded-lg hover:bg-primary-dark hover:shadow-[0_0_20px_rgba(255,103,25,0.4)] transition-all duration-300 transform hover:-translate-y-0.5"
          >
            Visit Peer Rotator →
          </a>
        </div>
      </div>
    </div >
  );
}

export default Dashboard;
