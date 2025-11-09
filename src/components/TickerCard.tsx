import { TickerData } from '../types';

interface TickerCardProps {
  data: TickerData;
}

function TickerCard({ data }: TickerCardProps) {
  const isPositive = data.changePercent24h >= 0;

  return (
    <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg p-6 shadow-xl">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-3xl font-bold text-white mb-1">{data.symbol}</h3>
          <p className="text-gray-300">{data.name}</p>
        </div>
        <div
          className={`px-4 py-2 rounded-lg ${
            isPositive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}
        >
          <span className="text-sm font-semibold">
            {isPositive ? '+' : ''}
            {data.changePercent24h.toFixed(2)}%
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-gray-400 text-sm">Price</p>
          <p className="text-4xl font-bold text-white">${data.price.toLocaleString()}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-600">
          <div>
            <p className="text-gray-400 text-sm">24h Change</p>
            <p
              className={`text-xl font-semibold ${
                isPositive ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {isPositive ? '+' : ''}${data.change24h.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Volume</p>
            <p className="text-xl font-semibold text-white">
              {data.volume.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Market Cap</p>
            <p className="text-xl font-semibold text-white">
              ${(data.marketCap / 1e9).toFixed(2)}B
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Last Updated</p>
            <p className="text-xl font-semibold text-white">
              {new Date(data.lastUpdated * 1000).toLocaleTimeString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TickerCard;

