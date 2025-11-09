import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import TickerCard from './TickerCard';
import RotationControls from './RotationControls';
import { SUPPORTED_TICKERS, TICKER_NAMES } from '../constants/tickers';
import { fetchTickerData } from '../services/tickerService';

interface TickerData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume: number;
  marketCap: number;
  lastUpdated: number;
}

function Dashboard() {
  const [rotationOrder, setRotationOrder] = useState<string[]>(SUPPORTED_TICKERS);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Fetch data for all tickers
  const tickerQueries = rotationOrder.map((ticker) =>
    useQuery({
      queryKey: ['ticker', ticker],
      queryFn: () => fetchTickerData(ticker),
      refetchInterval: 30000, // Refresh every 30 seconds
    })
  );

  const currentTicker = rotationOrder[currentIndex];
  const currentData = tickerQueries[currentIndex]?.data;

  const handleRotate = () => {
    setCurrentIndex((prev) => (prev + 1) % rotationOrder.length);
  };

  const handleRotateBack = () => {
    setCurrentIndex((prev) => (prev - 1 + rotationOrder.length) % rotationOrder.length);
  };

  const handleReorder = (newOrder: string[]) => {
    setRotationOrder(newOrder);
    setCurrentIndex(0);
  };

  return (
    <div className="space-y-8">
      <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
        <h2 className="text-2xl font-bold text-white mb-4">Current Ticker</h2>
        {currentData ? (
          <TickerCard data={currentData} />
        ) : (
          <div className="text-center py-8 text-gray-400">
            {tickerQueries[currentIndex]?.isLoading ? 'Loading...' : 'No data available'}
          </div>
        )}
      </div>

      <RotationControls
        currentIndex={currentIndex}
        rotationOrder={rotationOrder}
        onRotate={handleRotate}
        onRotateBack={handleRotateBack}
        onReorder={handleReorder}
      />

      <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
        <h2 className="text-xl font-bold text-white mb-4">All Tickers</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rotationOrder.map((ticker, index) => {
            const query = tickerQueries[index];
            const data = query?.data;
            const isActive = index === currentIndex;

            return (
              <div
                key={ticker}
                className={`p-4 rounded-lg border-2 ${
                  isActive
                    ? 'border-btc-orange bg-orange-900/20'
                    : 'border-gray-700 bg-gray-700/50'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-white">{ticker}</h3>
                    <p className="text-sm text-gray-400">{TICKER_NAMES[ticker as keyof typeof TICKER_NAMES]}</p>
                  </div>
                  {isActive && (
                    <span className="px-2 py-1 bg-btc-orange text-white text-xs rounded">Active</span>
                  )}
                </div>
                {data ? (
                  <div className="text-sm">
                    <p className="text-white">${data.price.toFixed(2)}</p>
                    <p
                      className={
                        data.changePercent24h >= 0 ? 'text-green-400' : 'text-red-400'
                      }
                    >
                      {data.changePercent24h >= 0 ? '+' : ''}
                      {data.changePercent24h.toFixed(2)}%
                    </p>
                  </div>
                ) : query?.isLoading ? (
                  <p className="text-gray-400 text-sm">Loading...</p>
                ) : (
                  <p className="text-gray-500 text-sm">No data</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

