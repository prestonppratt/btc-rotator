import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchBacktestData, type BacktestDataPoint } from '../services/backtestService';
import { fetchRotationSignal, type RotationSignal } from '../services/rotatorService';
import LoadingSpinner from './LoadingSpinner';


function Dashboard() {
  const [signal, setSignal] = useState<RotationSignal | null>(null);
  const [previousSignal, setPreviousSignal] = useState<RotationSignal | null>(null);
  const confettiTriggered = useRef(false);

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

      setPreviousSignal(newSignal);
    }
  }, [rotationData, previousSignal]);

  const triggerConfetti = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function() {
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
  const chartData = backtestData?.map((point: BacktestDataPoint) => ({
    date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    'Rotator Strategy': point.rotatorValue,
    'Hold BTC': point.btcValue,
  })) || [];

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
          <div className="relative bg-black border-2 sm:border-4 border-green-400 rounded-xl sm:rounded-2xl p-6 sm:p-8 md:p-12 shadow-2xl shadow-green-400/50">
            {/* Neon glow effect */}
            <div className="absolute inset-0 bg-green-400/10 rounded-xl sm:rounded-2xl blur-xl"></div>
            
            <div className="relative z-10 text-center">
              {rotationLoading ? (
                <div className="flex flex-col items-center gap-3 sm:gap-4">
                  <LoadingSpinner size="lg" className="border-neon-green border-t-neon-green" />
                  <div className="text-green-400 text-xl sm:text-2xl md:text-4xl font-bold">
                    Loading signal...
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-green-400 text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-bold mb-3 sm:mb-4 md:mb-6 tracking-wide break-words">
                    {displayMessage}
                  </div>
                  {signal?.shouldRotate && (
                    <div className="text-green-300 text-sm sm:text-base md:text-lg lg:text-xl mt-3 sm:mt-4">
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
          <div className={`px-4 sm:px-6 md:px-8 py-2 sm:py-3 md:py-4 rounded-full text-lg sm:text-2xl md:text-4xl font-bold ${
            alpha > 0 
              ? 'bg-green-500/20 text-green-400 border-2 border-green-400' 
              : 'bg-red-500/20 text-red-400 border-2 border-red-400'
          }`}>
            {alpha > 0 ? '+' : ''}{alpha.toFixed(2)}% alpha
          </div>
        </div>
      )}

      {/* Recharts Line Chart */}
      <div className="bg-gray-800 rounded-lg p-3 sm:p-4 md:p-6 shadow-lg">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-3 sm:mb-4 md:mb-6 text-center">
          Performance Comparison
        </h2>
        {backtestLoading ? (
          <div className="text-center py-8 sm:py-12 flex flex-col items-center gap-4">
            <LoadingSpinner size="lg" />
            <p className="text-gray-400 text-sm sm:text-base">Loading chart data...</p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="text-center py-8 sm:py-12 text-gray-400 text-sm sm:text-base">No backtest data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={300} className="sm:h-[400px]">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
                  backgroundColor: '#1F2937', 
                  border: '1px solid #374151',
                  borderRadius: '8px'
                }}
                formatter={(value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
              />
              <Line 
                type="monotone" 
                dataKey="Rotator Strategy" 
                stroke="#f7931a" 
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
        )}
      </div>
    </div>
  );
}

export default Dashboard;
