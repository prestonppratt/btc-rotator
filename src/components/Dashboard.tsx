import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ReferenceLine } from 'recharts';
import { fetchBacktestData, type BacktestDataPoint } from '../services/backtestService';
import { fetchRotationSignal, type RotationSignal } from '../services/rotatorService';
import { fetchHistoricalPricesFromBackend } from '../services/historicalPriceService';
import { listModels, runModelComparison, type ModelConfigInput } from '../services/modelingService';
import LoadingSpinner from './LoadingSpinner';
import { getCurrentUser } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { TICKER_NAMES, SUPPORTED_TICKERS } from '../constants/tickers';
import { useDenomination } from '../contexts/DenominationContext';
import { getPortfolioStorageKeys } from '../utils/userStorage';

const client = generateClient<Schema>();

interface PortfolioHolding {
  ticker: string;
  shares: number;
  pricePerShare: number;
}

interface PortfolioTransaction {
  ticker: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  priceUSD: number;
  timestamp: number;
}

type Timeframe = '1h' | '1d' | '1w' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y';

const performanceModelColor = (index: number): string => {
  const palette = ['#22C55E', '#A855F7', '#14B8A6', '#F97316', '#EF4444', '#F59E0B', '#8B5CF6', '#06B6D4'];
  return palette[index % palette.length];
};

const DEFAULT_MODEL_NAMES = [
  'Relative Momentum',
  'Time-Series Momentum',
  'Dual Momentum',
  'Volatility-Adjusted Momentum',
  'Mean Reversion',
  'Ensemble',
];

interface ModelTradeEvent {
  date: string;
  fromTicker: string;
  toTicker: string;
  fromPriceUSD: number;
  toPriceUSD: number;
  realizedGainLossUSD: number;
  postTradePositions: Array<{ ticker: string; weight: number; valueUSD: number }>;
}

interface ModelPnlSummary {
  realizedUSD: number;
  unrealizedUSD: number;
  netUSD: number;
}

function Dashboard({ mode = 'dashboard' }: { mode?: 'dashboard' | 'quant' }) {
  const { denomination } = useDenomination();
  const [signal, setSignal] = useState<RotationSignal | null>(null);
  const previousSignalRef = useRef<RotationSignal | null>(null);
  const confettiTriggered = useRef(false);
  const [portfolioHoldings, setPortfolioHoldings] = useState<PortfolioHolding[]>([]);
  const [portfolioTransactions, setPortfolioTransactions] = useState<PortfolioTransaction[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('1d');
  const [portfolioChartData, setPortfolioChartData] = useState<any[]>([]);
  const [isLoadingPortfolioChart, setIsLoadingPortfolioChart] = useState(false);
  const [bitcoinPrice, setBitcoinPrice] = useState<number>(0);
  const [allAssetsHistoricalData, setAllAssetsHistoricalData] = useState<Map<string, Array<{ date: string; timestamp: number; priceUSD: number; priceBTC: number }>>>(new Map());


  const [isLoadingAllAssetsData, setIsLoadingAllAssetsData] = useState(false);
  const [selectedAllAssetsTimeframe, setSelectedAllAssetsTimeframe] = useState<'1mo' | '3mo' | '6mo' | '1y'>('6mo');
  const [selectedAssetsToDisplay, setSelectedAssetsToDisplay] = useState<string[]>(
    SUPPORTED_TICKERS.filter(t => t !== 'BTC-USD')
  );
  const [selectedUSDAssetsTimeframe, setSelectedUSDAssetsTimeframe] = useState<'1mo' | '3mo' | '6mo' | '1y'>('6mo');
  const [selectedUSDAssetsToDisplay, setSelectedUSDAssetsToDisplay] = useState<string[]>([...SUPPORTED_TICKERS]);
  const [selectedFocusTicker, setSelectedFocusTicker] = useState<string>('BTC-USD');
  const [selectedFocusTimeframe, setSelectedFocusTimeframe] = useState<'1mo' | '3mo' | '6mo' | '1y'>('6mo');




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

  const [selectedPerformanceTimeframe, setSelectedPerformanceTimeframe] = useState<'1mo' | '3mo' | '6mo' | '1y' | 'ALL'>('ALL');
  const [availableModelNames, setAvailableModelNames] = useState<string[]>([]);
  const [selectedPerformanceModels, setSelectedPerformanceModels] = useState<string[]>([]);
  const [modelPerformanceSeries, setModelPerformanceSeries] = useState<Record<string, Array<{ date: string; equity: number }>>>({});
  const [isLoadingModelPerformance, setIsLoadingModelPerformance] = useState(false);
  const [modelPerformanceError, setModelPerformanceError] = useState<string | null>(null);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [modelListError, setModelListError] = useState<string | null>(null);
  const [modelTradeLogs, setModelTradeLogs] = useState<Record<string, ModelTradeEvent[]>>({});
  const [modelCurrentPositions, setModelCurrentPositions] = useState<Record<string, string>>({});
  const [modelPnlSummaries, setModelPnlSummaries] = useState<Record<string, ModelPnlSummary>>({});
  const performanceModelUniverse = useMemo(() => {
    const holdingsUniverse = Array.from(
      new Set(
        portfolioHoldings
          .map((h) => h.ticker)
          .filter((ticker) => SUPPORTED_TICKERS.includes(ticker as any))
      )
    );
    return holdingsUniverse.length > 0 ? holdingsUniverse : [...SUPPORTED_TICKERS];
  }, [portfolioHoldings]);

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
      const keys = getPortfolioStorageKeys(user);
      let loaded: PortfolioHolding[] | null = null;

      for (const key of keys) {
        const saved = localStorage.getItem(key);
        if (saved) {
          loaded = JSON.parse(saved) as PortfolioHolding[];
          break;
        }
      }

      if (!loaded) {
        setPortfolioHoldings([]);
        setPortfolioTransactions([]);
        return;
      }

      const validHoldings = loaded.filter(h => h.shares > 0);
      setPortfolioHoldings(validHoldings);

      try {
        const userData = await client.models.User.get({ id: user.userId });
        const rawTradeHistory = userData.data?.tradeHistory;
        const parsed = typeof rawTradeHistory === 'string' ? JSON.parse(rawTradeHistory) : rawTradeHistory;
        if (Array.isArray(parsed)) {
          const tx = parsed
            .map((item: any): PortfolioTransaction => ({
              ticker: String(item.ticker || ''),
              type: item.type === 'SELL' ? 'SELL' : 'BUY',
              quantity: Number(item.quantity || 0),
              priceUSD: Number(item.priceUSD || 0),
              timestamp: Number(item.timestamp || 0),
            }))
            .filter((item: PortfolioTransaction) =>
              Boolean(item.ticker) &&
              SUPPORTED_TICKERS.includes(item.ticker as any) &&
              item.quantity > 0 &&
              item.priceUSD > 0 &&
              item.timestamp > 0
            )
            .sort((a: PortfolioTransaction, b: PortfolioTransaction) => a.timestamp - b.timestamp);
          setPortfolioTransactions(tx);
        } else {
          setPortfolioTransactions([]);
        }
      } catch {
        setPortfolioTransactions([]);
      }
    } catch (e) {
      console.error('Error loading portfolio', e);
      setPortfolioHoldings([]);
      setPortfolioTransactions([]);
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

  const historicalSeriesMap = useMemo(() => {
    const map = new Map<string, Array<{ timestamp: number; priceUSD: number }>>();
    allAssetsHistoricalData.forEach((data, ticker) => {
      map.set(
        ticker,
        [...data]
          .map((p) => ({ timestamp: p.timestamp, priceUSD: p.priceUSD }))
          .sort((a, b) => a.timestamp - b.timestamp)
      );
    });
    return map;
  }, [allAssetsHistoricalData]);

  const findClosestPrice = (series: Array<{ timestamp: number; priceUSD: number }>, timestamp: number): number => {
    if (series.length === 0) return 0;
    let closest = series[0];
    let minDiff = Math.abs(series[0].timestamp - timestamp);

    for (const point of series) {
      const diff = Math.abs(point.timestamp - timestamp);
      if (diff < minDiff) {
        minDiff = diff;
        closest = point;
      }
    }
    return minDiff <= 24 * 60 * 60 * 1000 ? closest.priceUSD : 0;
  };

  const buildLocalModelBacktest = (
    modelName: string,
    rows: Array<Record<string, any> & { rawTs: number }>,
    stackStart: number,
    universeTickers: string[]
  ): { series: Array<{ date: string; equity: number }>; trades: ModelTradeEvent[]; currentTicker: string; summary: ModelPnlSummary } => {
    if (rows.length < 3) return {
      series: [],
      trades: [],
      currentTicker: 'N/A',
      summary: { realizedUSD: 0, unrealizedUSD: 0, netUSD: 0 },
    };
    const universe = universeTickers.filter((ticker) => (historicalSeriesMap.get(ticker) || []).length > 0);
    if (universe.length === 0) return {
      series: [],
      trades: [],
      currentTicker: 'N/A',
      summary: { realizedUSD: 0, unrealizedUSD: 0, netUSD: 0 },
    };

    const pricesByTicker: Record<string, number[]> = {};
    universe.forEach((ticker) => {
      const series = historicalSeriesMap.get(ticker) || [];
      pricesByTicker[ticker] = rows.map((r) => findClosestPrice(series, r.rawTs));
    });

    const mom = (arr: number[], i: number, lb: number): number => {
      if (i - lb < 0 || arr[i - lb] <= 0 || arr[i] <= 0) return 0;
      return (arr[i] / arr[i - lb]) - 1;
    };

    const vol = (arr: number[], i: number, lb: number): number => {
      if (i - lb < 1) return 0;
      const rets: number[] = [];
      for (let j = i - lb + 1; j <= i; j += 1) {
        if (arr[j - 1] > 0 && arr[j] > 0) rets.push((arr[j] / arr[j - 1]) - 1);
      }
      if (rets.length < 2) return 0;
      const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
      const variance = rets.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (rets.length - 1);
      return Math.sqrt(Math.max(variance, 0));
    };

    const scoreForTicker = (ticker: string, i: number): number => {
      const px = pricesByTicker[ticker];
      const m30 = mom(px, i, 30);
      const m90 = mom(px, i, 90);
      const m5 = mom(px, i, 5);
      const v30 = vol(px, i, 30) || 1e-9;
      const btcPx = pricesByTicker['BTC-USD'] || [];
      const btcTrend = btcPx.length > 0 ? mom(btcPx, i, 200) : 0;

      if (modelName === 'Relative Momentum') return m90;
      if (modelName === 'Time-Series Momentum') return m90 > 0 ? m90 : -1e9;
      if (modelName === 'Dual Momentum') {
        if (btcTrend <= 0) return ticker === 'BTC-USD' ? 1 : -1e9;
        return m90;
      }
      if (modelName === 'Volatility-Adjusted Momentum') return m90 / v30;
      if (modelName === 'Mean Reversion') return -m5;
      // Ensemble
      const dual = btcTrend <= 0 ? (ticker === 'BTC-USD' ? 1 : -1e9) : m90;
      return (0.4 * m90) + (0.3 * (m90 / v30)) + (0.3 * dual);
    };

    let equity = stackStart || 10000;
    const holdingsUnits: Record<string, number> = {};
    const avgCostUSD: Record<string, number> = {};
    universe.forEach((ticker) => {
      holdingsUnits[ticker] = 0;
      avgCostUSD[ticker] = 0;
    });
    const startTicker = universe.includes('BTC-USD') ? 'BTC-USD' : universe[0];
    const startPx = pricesByTicker[startTicker]?.[0] || 0;
    if (startPx > 0) {
      holdingsUnits[startTicker] = equity / startPx;
      avgCostUSD[startTicker] = startPx;
    }
    let prevTicker = startTicker;
    const trades: ModelTradeEvent[] = [];
    let cumulativeRealizedUSD = 0;
    const out: Array<{ date: string; equity: number }> = [
      { date: new Date(rows[0].rawTs).toISOString().slice(0, 10), equity },
    ];

    for (let i = 1; i < rows.length; i += 1) {
      // 1-bar delay: trade based on previous bar signal
      let bestTicker = prevTicker;
      let bestScore = -Infinity;
      const signalBar = i - 1;
      for (const ticker of universe) {
        const score = scoreForTicker(ticker, signalBar);
        if (score > bestScore) {
          bestScore = score;
          bestTicker = ticker;
        }
      }

      // Mark-to-market portfolio at execution bar i before rebalancing.
      let preTradeEquity = 0;
      for (const ticker of universe) {
        const px = pricesByTicker[ticker]?.[i] || 0;
        preTradeEquity += holdingsUnits[ticker] * px;
      }
      if (preTradeEquity > 0) {
        equity = preTradeEquity;
      }

      // Current weights
      const currentValueByTicker: Record<string, number> = {};
      for (const ticker of universe) {
        const px = pricesByTicker[ticker]?.[i] || 0;
        currentValueByTicker[ticker] = holdingsUnits[ticker] * px;
      }

      // Target: top-1 (current dashboard overlay model path).
      const targetWeights: Record<string, number> = {};
      universe.forEach((ticker) => { targetWeights[ticker] = ticker === bestTicker ? 1 : 0; });

      let realizedGainLossUSD = 0;
      let maxSellValue = 0;
      let maxBuyValue = 0;
      let primaryFromTicker = prevTicker;
      let primaryToTicker = bestTicker;

      // Sells first.
      for (const ticker of universe) {
        const px = pricesByTicker[ticker]?.[i] || 0;
        if (px <= 0) continue;
        const currentValue = currentValueByTicker[ticker] || 0;
        const targetValue = equity * (targetWeights[ticker] || 0);
        const deltaValue = targetValue - currentValue;
        if (deltaValue >= -1e-6) continue;

        const sellValue = Math.min(currentValue, Math.abs(deltaValue));
        if (sellValue <= 0) continue;
        const qtySell = sellValue / px;
        const cost = avgCostUSD[ticker] || 0;
        realizedGainLossUSD += (px - cost) * qtySell;
        holdingsUnits[ticker] = Math.max(0, holdingsUnits[ticker] - qtySell);

        if (sellValue > maxSellValue) {
          maxSellValue = sellValue;
          primaryFromTicker = ticker;
        }
      }

      // Buys next.
      for (const ticker of universe) {
        const px = pricesByTicker[ticker]?.[i] || 0;
        if (px <= 0) continue;
        const currentValue = holdingsUnits[ticker] * px;
        const targetValue = equity * (targetWeights[ticker] || 0);
        const deltaValue = targetValue - currentValue;
        if (deltaValue <= 1e-6) continue;

        const buyValue = deltaValue;
        const qtyBuy = buyValue / px;
        if (qtyBuy <= 0) continue;
        const prevQty = holdingsUnits[ticker];
        const prevCost = avgCostUSD[ticker] || 0;
        const newQty = prevQty + qtyBuy;
        avgCostUSD[ticker] = newQty > 0 ? ((prevQty * prevCost) + (qtyBuy * px)) / newQty : 0;
        holdingsUnits[ticker] = newQty;

        if (buyValue > maxBuyValue) {
          maxBuyValue = buyValue;
          primaryToTicker = ticker;
        }
      }

      // Post-trade position snapshot.
      const postTradePositions = universe
        .map((ticker) => {
          const px = pricesByTicker[ticker]?.[i] || 0;
          const valueUSD = holdingsUnits[ticker] * px;
          const weight = equity > 0 ? valueUSD / equity : 0;
          return { ticker, weight, valueUSD };
        })
        .filter((p) => p.valueUSD > 1e-6)
        .sort((a, b) => b.weight - a.weight);

      if (Math.abs(realizedGainLossUSD) > 1e-6 || primaryFromTicker !== primaryToTicker) {
        cumulativeRealizedUSD += realizedGainLossUSD;
        trades.push({
          date: new Date(rows[i].rawTs).toISOString().slice(0, 10),
          fromTicker: primaryFromTicker,
          toTicker: primaryToTicker,
          fromPriceUSD: pricesByTicker[primaryFromTicker]?.[i] || 0,
          toPriceUSD: pricesByTicker[primaryToTicker]?.[i] || 0,
          realizedGainLossUSD,
          postTradePositions,
        });
      }

      prevTicker = bestTicker;
      out.push({
        date: new Date(rows[i].rawTs).toISOString().slice(0, 10),
        equity,
      });
    }

    const lastIndex = rows.length - 1;
    let unrealizedUSD = 0;
    for (const ticker of universe) {
      const qty = holdingsUnits[ticker] || 0;
      const lastPx = pricesByTicker[ticker]?.[lastIndex] || 0;
      const cost = avgCostUSD[ticker] || 0;
      unrealizedUSD += qty * (lastPx - cost);
    }
    const initialEquity = out[0]?.equity || stackStart || 0;
    const finalEquity = out[out.length - 1]?.equity || initialEquity;
    const netUSD = finalEquity - initialEquity;

    return {
      series: out,
      trades,
      currentTicker: prevTicker,
      summary: {
        realizedUSD: cumulativeRealizedUSD,
        unrealizedUSD,
        netUSD,
      },
    };
  };

  const portfolioPerformanceData = useMemo(() => {
    const btcSeries = historicalSeriesMap.get('BTC-USD') || [];
    if (btcSeries.length === 0) return [] as Array<{ date: string; rawDate: Date; 'Stack Portfolio': number; 'Hold BTC': number }>;

    const getStartDateForTimeframe = () => {
      const now = new Date();
      if (selectedPerformanceTimeframe === 'ALL') return new Date(0);
      const start = new Date(now);
      if (selectedPerformanceTimeframe === '1mo') start.setMonth(start.getMonth() - 1);
      if (selectedPerformanceTimeframe === '3mo') start.setMonth(start.getMonth() - 3);
      if (selectedPerformanceTimeframe === '6mo') start.setMonth(start.getMonth() - 6);
      if (selectedPerformanceTimeframe === '1y') start.setFullYear(start.getFullYear() - 1);
      return start;
    };
    const timeframeStart = getStartDateForTimeframe().getTime();
    const filteredBtcSeries = btcSeries.filter((p) => p.timestamp >= timeframeStart);
    if (filteredBtcSeries.length === 0) return [];

    const points: Array<{ date: string; rawDate: Date; 'Stack Portfolio': number; 'Hold BTC': number }> = [];

    if (portfolioTransactions.length > 0) {
      const txSorted = [...portfolioTransactions].sort((a, b) => a.timestamp - b.timestamp);
      const quantityByTicker = new Map<string, number>();
      let benchmarkBtcUnits = 0;
      let txIndex = 0;

      for (const btcPoint of filteredBtcSeries) {
        while (txIndex < txSorted.length && txSorted[txIndex].timestamp <= btcPoint.timestamp) {
          const tx = txSorted[txIndex];
          const sign = tx.type === 'BUY' ? 1 : -1;
          quantityByTicker.set(tx.ticker, (quantityByTicker.get(tx.ticker) || 0) + sign * tx.quantity);
          const btcPriceAtTx = findClosestPrice(btcSeries, tx.timestamp);
          if (btcPriceAtTx > 0) {
            benchmarkBtcUnits += sign * ((tx.quantity * tx.priceUSD) / btcPriceAtTx);
          }
          txIndex += 1;
        }

        let stackValue = 0;
        for (const [ticker, qty] of quantityByTicker.entries()) {
          if (qty === 0) continue;
          const series = historicalSeriesMap.get(ticker) || [];
          const px = findClosestPrice(series, btcPoint.timestamp);
          if (px > 0) {
            stackValue += qty * px;
          }
        }

        points.push({
          date: new Date(btcPoint.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          rawDate: new Date(btcPoint.timestamp),
          'Stack Portfolio': stackValue,
          'Hold BTC': benchmarkBtcUnits * btcPoint.priceUSD,
        });
      }
    } else if (portfolioHoldings.length > 0) {
      const initialTimestamp = filteredBtcSeries[0].timestamp;
      let initialStackValue = 0;
      for (const holding of portfolioHoldings) {
        const series = historicalSeriesMap.get(holding.ticker) || [];
        const px = findClosestPrice(series, initialTimestamp);
        if (px > 0) {
          initialStackValue += holding.shares * px;
        }
      }
      const initialBtcPrice = filteredBtcSeries[0].priceUSD || 1;
      const benchmarkBtcUnits = initialStackValue / initialBtcPrice;

      for (const btcPoint of filteredBtcSeries) {
        let stackValue = 0;
        for (const holding of portfolioHoldings) {
          const series = historicalSeriesMap.get(holding.ticker) || [];
          const px = findClosestPrice(series, btcPoint.timestamp);
          if (px > 0) {
            stackValue += holding.shares * px;
          }
        }
        points.push({
          date: new Date(btcPoint.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          rawDate: new Date(btcPoint.timestamp),
          'Stack Portfolio': stackValue,
          'Hold BTC': benchmarkBtcUnits * btcPoint.priceUSD,
        });
      }
    }

    return points;
  }, [historicalSeriesMap, portfolioTransactions, portfolioHoldings, selectedPerformanceTimeframe]);

  const fallbackChartData = useMemo(() => {
    return backtestData?.map((point: BacktestDataPoint) => ({
      date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      rawDate: new Date(point.date),
      'Stack Portfolio': point.rotatorValue,
      'Hold BTC': point.btcValue,
    })) || [];
  }, [backtestData]);

  const filteredChartData = useMemo(() => {
    return portfolioPerformanceData.length > 0 ? portfolioPerformanceData : fallbackChartData;
  }, [portfolioPerformanceData, fallbackChartData]);

  const performanceDateWindow = useMemo(() => {
    if (filteredChartData.length === 0) return null;
    const first = filteredChartData[0]?.rawDate;
    const last = filteredChartData[filteredChartData.length - 1]?.rawDate;
    if (!first || !last) return null;
    return {
      startDate: new Date(first).toISOString().slice(0, 10),
      endDate: new Date(last).toISOString().slice(0, 10),
    };
  }, [filteredChartData]);

  const performanceStackStart = useMemo(() => {
    if (filteredChartData.length === 0) return 10000;
    return filteredChartData[0]?.['Stack Portfolio'] || 10000;
  }, [filteredChartData]);

  const selectedPerformanceModelsKey = useMemo(() => {
    return [...selectedPerformanceModels].sort().join('|');
  }, [selectedPerformanceModels]);

  const lastModelFetchKeyRef = useRef<string>('');

  useEffect(() => {
    const loadAvailableModels = async () => {
      try {
        const models = await listModels();
        if (models.length > 0) {
          setAvailableModelNames(models);
          setModelListError(null);
        } else {
          setAvailableModelNames(DEFAULT_MODEL_NAMES);
          setModelListError('Model endpoint returned no models. Showing default set.');
        }
      } catch (e) {
        console.error('Failed to load model list for Performance Overview', e);
        setAvailableModelNames(DEFAULT_MODEL_NAMES);
        setModelListError('Could not load models from backend. Showing default set.');
      }
    };
    void loadAvailableModels();
  }, []);

  useEffect(() => {
    const loadModelPerformance = async () => {
      if (!performanceDateWindow || selectedPerformanceModels.length === 0) {
        setModelPerformanceSeries({});
        setModelPerformanceError(null);
        setModelTradeLogs({});
        setModelCurrentPositions({});
        setModelPnlSummaries({});
        lastModelFetchKeyRef.current = '';
        return;
      }

      const fetchKey = `${performanceDateWindow.startDate}:${performanceDateWindow.endDate}:${selectedPerformanceModelsKey}`;
      if (fetchKey === lastModelFetchKeyRef.current) {
        return;
      }
      lastModelFetchKeyRef.current = fetchKey;

      setIsLoadingModelPerformance(true);
      setModelPerformanceError(null);
      try {
        const baseConfig: Partial<ModelConfigInput> = {
          models: selectedPerformanceModels,
          tickers: [...performanceModelUniverse],
          startDate: performanceDateWindow.startDate,
          endDate: performanceDateWindow.endDate,
          rebalanceFrequency: 'weekly',
          topN: 1,
          cashAllowed: true,
          lookback: 30,
          transactionCostBps: 5,
          slippageBps: 5,
          execution: 'next_close',
        };
        const comparison = await runModelComparison(baseConfig);

        const stackStart = performanceStackStart;
        const scaledSeries: Record<string, Array<{ date: string; equity: number }>> = {};
        comparison.models.forEach((model) => {
          if (!model.series || model.series.length === 0) return;
          const firstEquity = model.series[0].equity || 1;
          const scale = firstEquity > 0 ? stackStart / firstEquity : 1;
          scaledSeries[model.model] = model.series.map((point) => ({
            date: point.date,
            equity: point.equity * scale,
          }));
        });
        setModelPerformanceSeries(scaledSeries);

        // Build local trade logs so users can audit rotations by date/ticker.
        const baseRows: Array<Record<string, any> & { rawTs: number }> = filteredChartData
          .map((point) => ({
            ...point,
            rawTs: new Date(point.rawDate as Date).getTime(),
          }))
          .sort((a, b) => a.rawTs - b.rawTs);
        const tradeLogs: Record<string, ModelTradeEvent[]> = {};
        const currentPositions: Record<string, string> = {};
        const summaries: Record<string, ModelPnlSummary> = {};
        selectedPerformanceModels.forEach((modelName) => {
          const local = buildLocalModelBacktest(modelName, baseRows, performanceStackStart, performanceModelUniverse);
          tradeLogs[modelName] = local.trades;
          currentPositions[modelName] = local.currentTicker;
          summaries[modelName] = local.summary;
        });
        setModelTradeLogs(tradeLogs);
        setModelCurrentPositions(currentPositions);
        setModelPnlSummaries(summaries);
      } catch (e: any) {
        console.warn('Backend model comparison failed; using local fallback model curves.', e);
        const fallbackSeries: Record<string, Array<{ date: string; equity: number }>> = {};
        const baseRows: Array<Record<string, any> & { rawTs: number }> = filteredChartData
          .map((point) => ({
            ...point,
            rawTs: new Date(point.rawDate as Date).getTime(),
          }))
          .sort((a, b) => a.rawTs - b.rawTs);

        const tradeLogs: Record<string, ModelTradeEvent[]> = {};
        const currentPositions: Record<string, string> = {};
        const summaries: Record<string, ModelPnlSummary> = {};
        selectedPerformanceModels.forEach((model) => {
          const local = buildLocalModelBacktest(model, baseRows, performanceStackStart, performanceModelUniverse);
          if (local.series.length > 0) fallbackSeries[model] = local.series;
          tradeLogs[model] = local.trades;
          currentPositions[model] = local.currentTicker;
          summaries[model] = local.summary;
        });

        setModelPerformanceSeries(fallbackSeries);
        setModelTradeLogs(tradeLogs);
        setModelCurrentPositions(currentPositions);
        setModelPnlSummaries(summaries);
        setModelPerformanceError('Backend unavailable: showing locally computed model curves.');
      } finally {
        setIsLoadingModelPerformance(false);
      }
    };

    void loadModelPerformance();
  }, [performanceDateWindow, selectedPerformanceModels, selectedPerformanceModelsKey, performanceStackStart, performanceModelUniverse]);

  const performanceOverviewChartData = useMemo(() => {
    if (filteredChartData.length === 0) return [];

    const baseRows: Array<Record<string, any> & { rawTs: number }> = filteredChartData
      .map((point) => ({
        ...point,
        rawTs: new Date(point.rawDate as Date).getTime(),
      }))
      .sort((a, b) => a.rawTs - b.rawTs);

    const maxAlignDiffMs = 36 * 60 * 60 * 1000; // allow timezone/day-boundary drift

    Object.entries(modelPerformanceSeries).forEach(([modelName, series]) => {
      const modelRows = [...series]
        .map((p) => ({
          ts: new Date(p.date).getTime(),
          equity: p.equity,
        }))
        .filter((p) => Number.isFinite(p.ts) && Number.isFinite(p.equity))
        .sort((a, b) => a.ts - b.ts);

      if (modelRows.length === 0) return;

      for (const row of baseRows) {
        let closest = modelRows[0];
        let minDiff = Math.abs(modelRows[0].ts - row.rawTs);

        for (let i = 1; i < modelRows.length; i += 1) {
          const diff = Math.abs(modelRows[i].ts - row.rawTs);
          if (diff < minDiff) {
            minDiff = diff;
            closest = modelRows[i];
          } else if (modelRows[i].ts > row.rawTs && diff > minDiff) {
            // sorted series; stop early after diff begins widening past row time
            break;
          }
        }

        if (minDiff <= maxAlignDiffMs) {
          row[modelName] = closest.equity;
        }
      }
    });

    return baseRows;
  }, [filteredChartData, modelPerformanceSeries]);

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

  const focusTimeframeLabel: Record<'1mo' | '3mo' | '6mo' | '1y', string> = {
    '1mo': 'Past Month',
    '3mo': 'Past 3 Months',
    '6mo': 'Past 6 Months',
    '1y': 'Past Year',
  };

  const focusSeries = useMemo(() => {
    const raw = allAssetsHistoricalData.get(selectedFocusTicker) || [];
    if (raw.length === 0) {
      return [] as Array<{ timestamp: number; priceUSD: number; priceBTC: number }>;
    }

    const cutoffDate = new Date();
    switch (selectedFocusTimeframe) {
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
    const cutoffTs = cutoffDate.getTime();

    return raw
      .filter((point) => point.timestamp >= cutoffTs)
      .map((point) => ({
        timestamp: point.timestamp,
        priceUSD: point.priceUSD,
        priceBTC: point.priceBTC,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [allAssetsHistoricalData, selectedFocusTicker, selectedFocusTimeframe]);

  const focusStats = useMemo(() => {
    if (focusSeries.length === 0) {
      return null;
    }
    const first = focusSeries[0];
    const last = focusSeries[focusSeries.length - 1];
    const high = focusSeries.reduce((max, p) => Math.max(max, p.priceUSD), first.priceUSD);
    const low = focusSeries.reduce((min, p) => Math.min(min, p.priceUSD), first.priceUSD);
    const change = last.priceUSD - first.priceUSD;
    const changePct = first.priceUSD > 0 ? (change / first.priceUSD) * 100 : 0;

    return {
      first,
      last,
      high,
      low,
      change,
      changePct,
      points: focusSeries.length,
    };
  }, [focusSeries]);

  const focusChartData = useMemo(() => {
    return focusSeries.map((point) => ({
      ...point,
      chartValue: denomination === 'Sats' ? point.priceBTC * 100_000_000 : point.priceUSD,
    }));
  }, [focusSeries, denomination]);

  return (
    <div className="space-y-6 md:space-y-8 px-4 sm:px-6 lg:px-8">
      {/* Small gray text top-right */}
      <div className="flex justify-end">
        <p className="text-xs text-gray-500">
          Entertainment only • Not advice • At your own risk
        </p>
      </div>

      {mode === 'quant' && (
      <>
      {/* Recharts Line Chart */}
      <div className="bg-[#1C1C1E] border border-gray-800 rounded-xl p-4 sm:p-6 shadow-premium transition-all">
        <div className="relative z-30 flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h2 className="text-xl font-semibold text-white tracking-tight">
            Performance Overview
          </h2>
          <div className="flex flex-col items-start sm:items-end gap-2 w-full sm:w-auto">
            <div className="relative">
              <button
                onClick={() => setIsModelSelectorOpen((prev) => !prev)}
                className="px-3 py-2 text-xs rounded-md transition-all duration-200 font-medium text-gray-200 hover:text-white bg-[#2C2C2E] border border-gray-700 min-w-[180px] text-left"
              >
                {selectedPerformanceModels.length === 0
                  ? 'Select Models'
                  : selectedPerformanceModels.length === 1
                    ? selectedPerformanceModels[0]
                    : `${selectedPerformanceModels.length} models selected`}
              </button>
              {isModelSelectorOpen && (
                <div className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-lg border border-gray-700 bg-[#1C1C1E] shadow-xl z-[120] p-3 pointer-events-auto">
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => setSelectedPerformanceModels(availableModelNames)}
                      className="px-2 py-1 text-[11px] rounded bg-[#2C2C2E] text-gray-300 hover:text-white"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => setSelectedPerformanceModels([])}
                      className="px-2 py-1 text-[11px] rounded bg-[#2C2C2E] text-gray-300 hover:text-white"
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => setIsModelSelectorOpen(false)}
                      className="ml-auto px-2 py-1 text-[11px] rounded bg-[#2C2C2E] text-gray-300 hover:text-white"
                    >
                      Done
                    </button>
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                    {availableModelNames.length === 0 ? (
                      <div className="text-xs text-gray-500">No models available.</div>
                    ) : (
                      availableModelNames.map((model) => (
                        <label key={model} className="text-xs text-gray-300 inline-flex items-center gap-2 w-full">
                          <input
                            type="checkbox"
                            checked={selectedPerformanceModels.includes(model)}
                            onChange={(e) => {
                              setSelectedPerformanceModels((prev) =>
                                e.target.checked ? [...prev, model] : prev.filter((m) => m !== model)
                              );
                            }}
                          />
                          {model}
                        </label>
                      ))
                    )}
                  </div>
                  {modelListError && <div className="text-[11px] text-yellow-400 mt-2">{modelListError}</div>}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1 bg-[#2C2C2E] p-1 rounded-lg">
              {(['1mo', '3mo', '6mo', '1y', 'ALL'] as const).map((tf) => (
                <button
                key={tf}
                onClick={() => setSelectedPerformanceTimeframe(tf)}
                className={`px-4 py-1.5 text-sm rounded-md transition-all duration-200 font-medium ${selectedPerformanceTimeframe === tf
                  ? 'bg-[#3A3A3C] text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
                  }`}
              >
                {tf}
              </button>
            ))}
            </div>
          </div>
        </div>
        {isLoadingModelPerformance && (
          <div className="text-xs text-gray-500 mb-3">Loading selected model overlays...</div>
        )}
        {modelPerformanceError && (
          <div className="text-xs text-red-400 mb-3">{modelPerformanceError}</div>
        )}
        {backtestLoading ? (
          <div className="text-center py-8 sm:py-12 flex flex-col items-center gap-4">
            <LoadingSpinner size="lg" />
            <p className="text-gray-400 text-sm sm:text-base">Loading chart data...</p>
          </div>
        ) : filteredChartData.length === 0 ? (
          <div className="text-center py-8 sm:py-12 text-gray-400 text-sm sm:text-base">No performance data available yet. Add transactions in Stack to track real performance.</div>
        ) : (
          <ResponsiveContainer width="100%" height={320} className="sm:h-[400px] relative z-0">
            <LineChart data={performanceOverviewChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2C2C2E" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#6B7280"
                style={{ fontSize: '12px', fontFamily: 'Inter' }}
                tickLine={false}
                axisLine={false}
                dy={10}
              />
              <YAxis
                stroke="#6B7280"
                style={{ fontSize: '12px', fontFamily: 'Inter' }}
                tickFormatter={(value) => `$${value.toLocaleString()}`}
                tickLine={false}
                axisLine={false}
                dx={-10}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(28, 28, 30, 0.95)',
                  border: '1px solid #3A3A3C',
                  borderRadius: '12px',
                  backdropFilter: 'blur(8px)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  color: '#fff',
                  fontFamily: 'Inter',
                }}
                itemStyle={{ color: '#E5E7EB' }}
                formatter={(value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              />
              <Legend
                wrapperStyle={{ paddingTop: '20px', fontFamily: 'Inter', fontSize: '13px' }}
                iconType="circle"
              />
              <Line
                type="monotone"
                dataKey="Stack Portfolio"
                stroke="#0A84FF"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 6, strokeWidth: 0, fill: '#0A84FF' }}
                name="Stack Portfolio"
              />
              <Line
                type="monotone"
                dataKey="Hold BTC"
                stroke="#6B7280" // Grayed out baseline benchmark
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6, strokeWidth: 0, fill: '#6B7280' }}
                name="Hold BTC"
              />
              {selectedPerformanceModels.map((modelName, idx) => (
                <Line
                  key={modelName}
                  type="monotone"
                  dataKey={modelName}
                  stroke={performanceModelColor(idx)}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={true}
                  activeDot={{ r: 5, strokeWidth: 0, fill: performanceModelColor(idx) }}
                  name={modelName}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )
        }
      </div>

      {selectedPerformanceModels.length > 0 && (
        <div className="bg-[#1C1C1E] border border-gray-800 rounded-xl p-4 sm:p-6 shadow-premium">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Model Rotation Log</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {selectedPerformanceModels.map((modelName) => {
              const trades = modelTradeLogs[modelName] || [];
              const current = modelCurrentPositions[modelName] || 'N/A';
              const summary = modelPnlSummaries[modelName] || { realizedUSD: 0, unrealizedUSD: 0, netUSD: 0 };
              return (
                <div key={modelName} className="border border-gray-800 rounded-lg overflow-hidden min-w-0">
                  <div className="px-3 py-2 bg-[#202126] flex items-center justify-between">
                    <div className="text-sm text-white font-medium">{modelName}</div>
                    <div className="text-xs text-gray-400">Current Position: <span className="text-gray-200">{current}</span></div>
                  </div>
                  {trades.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-gray-500">No rotations in selected window.</div>
                  ) : (
                    <div className="max-h-56 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-[#17181D] text-gray-400 text-xs uppercase tracking-wider">
                          <tr>
                            <th className="px-3 py-2 text-left">Date</th>
                            <th className="px-3 py-2 text-left">From</th>
                            <th className="px-3 py-2 text-left">To</th>
                            <th className="px-3 py-2 text-right">From Px</th>
                            <th className="px-3 py-2 text-right">To Px</th>
                            <th className="px-3 py-2 text-right">Realized G/L</th>
                            <th className="px-3 py-2 text-left">Post-Trade Positions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trades.map((trade, idx) => (
                            <tr key={`${modelName}_${trade.date}_${trade.toTicker}_${idx}`} className="border-t border-gray-800">
                              <td className="px-3 py-2 text-gray-300">{new Date(trade.date).toLocaleDateString()}</td>
                              <td className="px-3 py-2 text-gray-300">{trade.fromTicker}</td>
                              <td className="px-3 py-2 text-white">{trade.toTicker}</td>
                              <td className="px-3 py-2 text-right text-gray-300 font-mono">${trade.fromPriceUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="px-3 py-2 text-right text-gray-300 font-mono">${trade.toPriceUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className={`px-3 py-2 text-right font-mono ${trade.realizedGainLossUSD >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {trade.realizedGainLossUSD >= 0 ? '+' : '-'}${Math.abs(trade.realizedGainLossUSD).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-3 py-2 text-gray-300 text-xs">
                                {trade.postTradePositions.map((p) => `${p.ticker} ${(p.weight * 100).toFixed(1)}%`).join(' · ')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="px-3 py-2 border-t border-gray-800 bg-[#17181D] flex justify-between text-xs">
                    <span className="text-gray-500">Realized Only</span>
                    <span className={`font-mono ${(summary.realizedUSD >= 0) ? 'text-green-400' : 'text-red-400'}`}>
                      {summary.realizedUSD >= 0 ? '+' : '-'}
                      ${Math.abs(summary.realizedUSD).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="px-3 py-2 border-t border-gray-800 bg-[#17181D] flex justify-between text-xs">
                    <span className="text-gray-500">Unrealized</span>
                    <span className={`font-mono ${(summary.unrealizedUSD >= 0) ? 'text-green-400' : 'text-red-400'}`}>
                      {summary.unrealizedUSD >= 0 ? '+' : '-'}
                      ${Math.abs(summary.unrealizedUSD).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="px-3 py-2 border-t border-gray-800 bg-[#17181D] flex justify-between text-xs">
                    <span className="text-gray-500">Net P/L (Equity)</span>
                    <span className={`font-mono ${(summary.netUSD >= 0) ? 'text-green-400' : 'text-red-400'}`}>
                      {summary.netUSD >= 0 ? '+' : '-'}
                      ${Math.abs(summary.netUSD).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </>
      )}

      {/* Portfolio Positions Chart */}
      {mode === 'dashboard' && false && portfolioHoldings.length > 0 && (
        <div className="bg-[#1C1C1E] border border-gray-800 rounded-xl p-4 sm:p-6 shadow-premium transition-all">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white tracking-tight">
                Stack Value (₿)
              </h2>
              <div className="flex items-baseline gap-2 mt-1">
                {portfolioChartData.length > 0 && (
                  <span className="text-2xl font-bold text-white text-numeric tracking-tight">
                    ₿{formatBitcoin((portfolioChartData[portfolioChartData.length - 1]?.['Total Stack Value'] as number) || 0)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-1 bg-[#2C2C2E] p-1 rounded-lg">
              {(['1h', '1d', '1w', '1mo', '3mo', '6mo', '1y', '2y', '5y'] as Timeframe[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setSelectedTimeframe(tf)}
                  className={`px-3 py-1 text-sm rounded-md transition-all duration-200 font-medium ${selectedTimeframe === tf
                    ? 'bg-[#3A3A3C] text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
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
              <LineChart data={portfolioChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2C2C2E" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#6B7280"
                  style={{ fontSize: '12px', fontFamily: 'Inter' }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#6B7280"
                  style={{ fontSize: '12px', fontFamily: 'Inter' }}
                  tickFormatter={(value) => {
                    if (value === 0) return '₿0';
                    return `₿${formatBitcoin(value)}`;
                  }}
                  tickLine={false}
                  axisLine={false}
                  dx={-10}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(28, 28, 30, 0.95)',
                    border: '1px solid #3A3A3C',
                    borderRadius: '12px',
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    color: '#fff',
                    fontFamily: 'Inter',
                  }}
                  itemStyle={{ color: '#E5E7EB' }}
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
                  wrapperStyle={{ paddingTop: '20px', fontFamily: 'Inter', fontSize: '13px' }}
                  iconType="circle"
                />
                {/* Line for each position showing unit price in BTC */}
                {portfolioHoldings.map((holding, index) => {
                  // Apple-inspired distinct palette
                  const colors = [
                    '#32D74B', // green
                    '#0A84FF', // blue
                    '#FF9F0A', // amber
                    '#FF375F', // red
                    '#BF5AF2', // purple
                    '#FF3B30', // sharp red
                    '#5E5CE6', // indigo
                    '#30D158', // lime
                    '#FFCC00', // yellow
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
                      activeDot={{ r: 5, strokeWidth: 0, fill: color }}
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
        </div>
      )}


      {mode === 'dashboard' && (
      <>
      {/* Fidelity + Apple Style Focus Chart */}
      <div className="rounded-2xl border border-gray-800 bg-[#16171B] p-4 sm:p-6 shadow-premium overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-5">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-2">Market Focus</div>
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
                {selectedFocusTicker}
              </h2>
              <p className="text-gray-400 text-base sm:text-lg">
                {TICKER_NAMES[selectedFocusTicker as keyof typeof TICKER_NAMES] || selectedFocusTicker}
              </p>
            </div>
          </div>

          {focusStats && (
            <div className="text-left lg:text-right">
              <div className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
                ${focusStats.last.priceUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className={`text-sm sm:text-base font-semibold ${focusStats.changePct >= 0 ? 'text-[#32D74B]' : 'text-[#FF453A]'}`}>
                {focusStats.changePct >= 0 ? '+' : ''}{focusStats.changePct.toFixed(2)}% {focusTimeframeLabel[selectedFocusTimeframe]}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-2">
            {SUPPORTED_TICKERS.map((ticker) => (
              <button
                key={ticker}
                onClick={() => setSelectedFocusTicker(ticker)}
                className={`px-3 py-1.5 rounded-full text-xs sm:text-sm transition-all ${selectedFocusTicker === ticker
                  ? 'bg-[#2A2D35] text-white border border-gray-600'
                  : 'bg-[#1E2128] text-gray-400 border border-transparent hover:text-white'
                  }`}
              >
                {ticker}
              </button>
            ))}
          </div>
          <div className="flex gap-2 bg-[#1E2128] rounded-xl p-1">
            {(['1mo', '3mo', '6mo', '1y'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedFocusTimeframe(tf)}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${selectedFocusTimeframe === tf
                  ? 'bg-[#2A2D35] text-white'
                  : 'text-gray-400 hover:text-white'
                  }`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {focusChartData.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm sm:text-base">
            No chart data available for {selectedFocusTicker} in this timeframe.
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={380}>
              <AreaChart data={focusChartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="focusChartFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={focusStats && focusStats.changePct >= 0 ? '#32D74B' : '#FF453A'} stopOpacity={0.42} />
                    <stop offset="100%" stopColor={focusStats && focusStats.changePct >= 0 ? '#32D74B' : '#FF453A'} stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#262A33" strokeDasharray="2 8" vertical={false} />
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(ts) => {
                    const date = new Date(ts);
                    return selectedFocusTimeframe === '1mo' || selectedFocusTimeframe === '3mo'
                      ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                  }}
                  stroke="#707782"
                  tickLine={false}
                  axisLine={false}
                  style={{ fontSize: '12px' }}
                />
                <YAxis
                  orientation="right"
                  dataKey="chartValue"
                  stroke="#707782"
                  tickLine={false}
                  axisLine={false}
                  style={{ fontSize: '12px' }}
                  tickFormatter={(value) => denomination === 'Sats'
                    ? `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                    : `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                  }
                />
                <Tooltip
                  cursor={{ stroke: '#6B7280', strokeWidth: 1, strokeDasharray: '4 4' }}
                  contentStyle={{
                    backgroundColor: 'rgba(17, 18, 24, 0.96)',
                    border: '1px solid #2B2F38',
                    borderRadius: '12px',
                    color: '#fff',
                    backdropFilter: 'blur(8px)',
                  }}
                  labelFormatter={(label) => new Date(Number(label)).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  formatter={(value: number) => {
                    if (denomination === 'Sats') {
                      return [`${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} sats`, 'Price'];
                    }
                    return [`$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Price'];
                  }}
                />
                <ReferenceLine y={focusChartData[0].chartValue} stroke="#4B5563" strokeDasharray="4 4" />
                <Area
                  type="monotone"
                  dataKey="chartValue"
                  stroke={focusStats && focusStats.changePct >= 0 ? '#32D74B' : '#FF453A'}
                  strokeWidth={3}
                  fill="url(#focusChartFill)"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>

            {focusStats && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                <div className="bg-[#1E2128] rounded-xl p-3 border border-gray-800">
                  <div className="text-gray-500 text-xs mb-1">Open</div>
                  <div className="text-white font-semibold">${focusStats.first.priceUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div className="bg-[#1E2128] rounded-xl p-3 border border-gray-800">
                  <div className="text-gray-500 text-xs mb-1">High</div>
                  <div className="text-white font-semibold">${focusStats.high.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div className="bg-[#1E2128] rounded-xl p-3 border border-gray-800">
                  <div className="text-gray-500 text-xs mb-1">Low</div>
                  <div className="text-white font-semibold">${focusStats.low.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div className="bg-[#1E2128] rounded-xl p-3 border border-gray-800">
                  <div className="text-gray-500 text-xs mb-1">Current</div>
                  <div className="text-white font-semibold">${focusStats.last.priceUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div className="bg-[#1E2128] rounded-xl p-3 border border-gray-800">
                  <div className="text-gray-500 text-xs mb-1">Data Points</div>
                  <div className="text-white font-semibold">{focusStats.points.toLocaleString()}</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>


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
            No historical data available yet. Automatic backend ingestion should populate this shortly.
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
      </div>

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
      </>
      )}
    </div >
  );
}

export default Dashboard;
